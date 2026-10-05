# Lab ERP — Architecture

## Folder layout

```
prisma/schema.prisma        data model (single source of truth)
prisma/seed.ts              master lists + first admin (idempotent)
src/
  app/
    (app)/                  app shell (sidebar, mobile menu)
      samples/              Sample Data Entry · /[id] details · /[id]/edit
      inward-outward/       Inward / Outward (entry, recent, rectification) · /[id] · /[id]/edit
      dashboard/            Dashboard (today, overall, announcements) — the landing page
      reports/              Reports (?range=7|15|30)
      downloads/            Downloads (date download + filtered export)
    api/downloads           ?kind=entry|inward|complete|filtered&date=… → .xlsx
      master-data/          Master Data
    api/uploads             file upload (validate → store → unlinked attachment)
    api/files/[id]          authenticated file view / download
    api/inngest             background jobs endpoint
  modules/
    registry.ts             the 7 sections: route, icon, permission, live/planned
    samples/                schema (Zod), service (save/delete), numbering,
                            queries (DTOs), actions, components
    inward-outward/         schema, service, queries, actions, components
    formulation/            writeFormulation() for any owner (sample, inward entry …)
    master-data/            catalog (seeded lists + behaviour codes), service,
                            actions, components
  components/ui/            Field, FormSection, Dialog/ConfirmDialog, Segmented,
                            MasterPicker (searchable single/multi + OTHER)
  components/lab/           shared lab form blocks used by every section:
                            FormulationFields / FormulationView, DesignFields
                            (+ Roy Body), LabRowsFields (+ useBodyRows)
  lib/                      db, permissions, session, audit, storage, uploads,
                            normalize, utils
```

Adding a section later = one entry in `modules/registry.ts` + `app/(app)/<route>` + `modules/<name>/`. Adding a permission = one line in `lib/permissions.ts`.

## Data model

```
LabSample ─┬─ Formulation (role: MAIN_BODY | DESIGN_ROY_BODY | VEIN_ROY_BODY, bodyIndex)
           │     └─ FormulationComponent (kind: RESIN | GRIT | FILLER | PIGMENT,
           │                              material → MasterValue, size → MasterValue,
           │                              unit GRAMS|PERCENT, quantity DECIMAL)
           ├─ SampleDesignPattern  (sample × pattern, many-to-many)
           ├─ SampleVeinMethod     (sample × method, many-to-many)
           ├─ LabMeasurement       (stage POST_PRESS|POST_POLISH × bodyIndex → L, a, b)
           └─ SampleAttachment     (metadata; bytes in storage)

InwardOutwardEntry ─┬─ labSample (optional, unique) → LabSample (Inspired)
                    ├─ company → MasterValue (Companies list)
                    ├─ InwardDesignPattern (entry × pattern)
                    ├─ InwardMeasurement   (bodyIndex → L, a, b; no press/polish split)
                    └─ Formulation (role DESIGN_ROY_BODY) — same table as samples

MasterCategory 1─* MasterValue   (label, normalizedKey, code, isActive)
User, AuditLog
```

Key decisions:

* **One formulation structure, many uses.** Main body and both Roy Body forms are `Formulation` rows distinguished by `role`; the UI is one `FormulationFields` component with a different path. A new body type is a new enum value. `bodyIndex` is reserved for per-body formulations if the lab later wants Body 1 / Body 2 to have separate recipes.
* **No comma-separated values.** Pigments, design patterns and vein methods are child rows; "Carrara, Vein, Roy Body" is only how the register *displays* them.
* **Master data is data.** Every dropdown is a `MasterValue` in a `MasterCategory`. Uniqueness is on `(category, normalizedKey)` where the key is trimmed, space-collapsed and lower-cased — so "Glass" and " glass" cannot both exist. Values are disabled (`isActive = false`), never deleted; foreign keys use `RESTRICT` so a used value cannot vanish.
* **Behaviour by code, not label.** "ROY BODY" opens the Roy Body form because its value carries `code = ROY_BODY`; "Creative Sample" opens the formulation form via `code = CREATIVE`. Labels can be renamed freely.
* **OTHER.** Choosing *Other* (or typing a value that is not on the list) creates the value at save time inside the same transaction. *Save to the list for future use* (ticked by default) makes it active; unticked, it is stored disabled — kept with the sample, out of everyone's dropdown, and visible under *Disabled* in Master Data.
* **Numbering.** `modules/samples/numbering.ts`: S.No. = max + 1; Slab = last sample's slab + 1, skipping numbers already taken. Saves take a PostgreSQL advisory lock so concurrent saves cannot collide; unique constraints are the final guarantee. Untouched suggestions are re-allocated at save time. Only Admin/Manager can type their own numbers.
* **Delete.** As specified, Delete removes the sample permanently (after confirmation). Its complete record is written to `AuditLog.snapshot` first, so the history survives. Every create/update/delete and master-data change is audited.
* **Files.** Bytes go through `lib/storage` (local disk now, object storage later); Postgres keeps metadata and a SHA-256 for duplicate detection. Uploads are checked for extension, size and magic bytes (a renamed .exe is rejected). Files upload immediately and are linked on save; abandoned uploads are deleted nightly by an Inngest job.
* **Validation.** One Zod schema (`modules/samples/schema.ts`) drives React Hook Form in the browser and is re-run by the server action. Nothing is mandatory; what is typed must make sense (numbers numeric, n a whole number 1–20, % ≤ 100, L 0–100, a/b −128…128, no duplicate selections).
* **Prisma client** runs with `engineType = "client"` through the `pg` driver adapter: no native query engine at runtime, same code locally and on Neon.

## Phase-1 interpretations (ambiguous points in the brief)

* **Vein** is a Yes/No field; *How Vein Introduced* and *Vein details* apply unless "No vein" is chosen.
* **Inspired Sample** records basic information, remarks and output files; the formulation form opens for Creative Sample only (as specified). When the Inspired workflow is defined, it plugs in by sample-type code.
* Material rows default to one each (Resin, Grit, Filler) with *Add another* for samples that use two grits etc.
* Pigments: each selected colour gets its own quantity and unit.
* *Recent Entries* shows the 10 most recently created samples; drafts are badged.

## Inward / Outward and Rectification

* Sample Data Entry → Sample Type **Inspired** shows **Physical Sample Present?** (Yes / No), stored on `LabSample.physicalSamplePresent`.
* **Yes:** after saving, the user is taken to Inward / Outward with the form linked to that lab sample (`?sample=<id>`). The entry stores `labSampleId` (one entry per sample; opening the link again goes to the existing entry's edit page).
* **No:** nothing opens; the sample is listed under **Rectification** (Inward / Outward page, third subsection). When the sample arrives, *Sample received* opens the linked Inward form; saving it sets the flag to Yes and the sample leaves Rectification.
* Inward entries have their own sequential **Serial Number** (same allocation rules as S.No.). In Recent Entries, *S.No.* is the row number and *Serial Number* the entry's number, with the linked lab S.No. under it.
* **Company Name** is a master list (Companies) so the same company is never spelled two ways; new companies are added from the form exactly like OTHER values.
* Delete is permanent after confirmation, with the full record in the audit log. Deleting an inward entry does not delete the lab sample.

## Reports

* `modules/reports/build.ts` is pure aggregation (unit-tested in `tests/report-build.test.ts`); `queries.ts` loads the samples dated inside the window in one query; the page passes the result to client chart components (Recharts).
* **Date basis:** the sample's Date field, last N days including today (plant time zone). Drafts count.
* **Count axes** run 0–12 as specified and grow only if a single day exceeds 12, so nothing is ever cut off.
* **Design Analysis** counts a sample once per pattern; Plain Body is its own bar. Inspired samples take their design from their Inward / Outward entry.
* **Material Consumption** sums grams across every formulation of the sample (main body + Roy Bodies), stacked by material — the five largest by name, the rest folded into "Other". Quantities recorded in **%** are a share of a batch, not a weight, so they are not added; the chart shows how many were left out. A quantity with no unit is read as grams.
* Colours come from a validated colour-blind-safe palette in fixed order (`components/palette.ts`); every chart has a Table view.

## Dashboard

* Landing page (`/` → `/dashboard`). `modules/dashboard/queries.ts` computes everything from the database in one round of parallel queries.
* **Today** = samples whose Date is today in the plant time zone (`lib/plant-time.ts`), plus Inward / Outward entries created today (for designs).
* **Lab vs Line:** Line samples are not recorded yet, so every sample is a Lab sample and Line shows 0. Total Production Samples is 0 until the Production Sample section exists. When either is built, only `getDashboard()` changes.
* **Designs worked on** = design patterns (Plain Body counts as one) plus the Sample Design Names typed in Inward / Outward, merged ignoring case/spaces (`designs.ts`, unit-tested). More than 8 today → "View all designs".
* **Total Companies** = active values in the Companies master list. **Rectification** = Inspired samples with Physical Sample Present = No.
* **Request / Announcement:** `Announcement` table (type, title, message, important, author, time). Managers and Admins publish; the author or an Admin can edit or remove. Removing archives the row (never deleted). Important ones are pinned first, the newest is shown large, and a banner at the top of the dashboard shows the latest one.

## Downloads (Excel)

* One endpoint, `GET /api/downloads?kind=…&date=YYYY-MM-DD[&type&design&pattern&mkind&material]`, builds the workbook with ExcelJS (`modules/downloads/excel.ts`) and returns only the records of that date (and filters). Viewer role and up can download.
* **Date meaning:** Data Entry samples by their Date field; Inward / Outward entries by the plant day they were recorded.
* **Data Entry Sample:** one row per sample with every form field, grouped under two-row headers (Basic Information, Material Choices, Design, Roy Body — Design, Mixer & Vein, Roy Body — Vein, L a b Post Press / Post Polish with one column per body, Output & Record). Extra sheets: *Formulation Detail* (one row per component, numeric quantity) and *L a b* (one row per reading).
* **Inward / Outward Sample:** same idea for the inward form.
* **Complete Sample Report:** one row per lab sample with its linked Inward / Outward entry beside it, plus inward entries recorded that day that are not already on a row; column groups are prefixed "Data Entry ·" / "Inward / Outward ·".
* **Filtered Data Export:** filters live in the URL (`/downloads?apply=1&date=…`), so Apply, the on-screen results and the Excel use the same query and always match. Design / pattern for Inspired samples come from their Inward entry. Material Consumption filters to samples that use the chosen category (or material) and totals its grams across all formulations; % entries are counted separately. The file has the summary sheet with a Total row, the full Data Entry columns for the same samples, and a *Filters Applied* sheet.
* Filter logic is pure and unit-tested (`tests/download-filters.test.ts`).

## Sign-in (off for now)

Authentication was removed at the client's request. `lib/session.ts` returns one built-in Admin user (created on first use from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME`), so "created by" stays meaningful. Permission checks (`can()` / `requirePermission()`) are unchanged and still run on every action; with the Admin role they all pass. Re-enabling sign-in = making `currentUser()` read a session again (e.g. Auth.js v5 credentials) and adding a login page; the `User.passwordHash` / `role` columns are already there.

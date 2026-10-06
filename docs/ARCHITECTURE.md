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
      production-sample/    Production Sample (entry + register, ?page=) · /[id] · /[id]/edit
      dashboard/            Dashboard (today, overall, Forum) — the landing page
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
    production/             Production Sample: schema, numbering, service,
                            queries (detail + paged register), actions, components
    formulation/            writeFormulation() for any owner (sample, inward entry …)
    forum/                  Forum posts + threaded replies: kinds, schema (Zod),
                            queries, actions, components
    master-data/            catalog (seeded lists + behaviour codes), service,
                            actions, components
  components/ui/            Field, FormSection, Dialog/ConfirmDialog, Segmented,
                            MasterPicker (searchable single/multi + OTHER)
  components/lab/           shared lab form blocks used by every section:
                            FormulationFields / FormulationView, DesignFields
                            (+ Roy Body, or a custom Roy Body form via `roy`),
                            RoyBodyLabFields (n + L/a/b only), LabRowsFields
                            (+ useBodyRows), LabTablesView (read-only L/a/b)
  lib/                      db, permissions, session, audit, storage, uploads,
                            normalize, utils
```

Adding a section later = one entry in `modules/registry.ts` + `app/(app)/<route>` + `modules/<name>/`. Adding a permission = one line in `lib/permissions.ts`.

## Data model

```
LabSample ─┬─ designNameValue → MasterValue (Design Names list)
           ├─ SampleBody (bodyIndex 1…n: designCategory, mixerType, hasVein, veinNotes)
           │     ├─ SampleBodyDesignPattern (body × pattern)
           │     └─ SampleBodyVeinMethod    (body × method)
           ├─ Formulation (role: MAIN_BODY | DESIGN_ROY_BODY | VEIN_ROY_BODY, bodyIndex = the body)
           │     └─ FormulationComponent (kind: RESIN | GRIT | FILLER | PIGMENT,
           │                              material → MasterValue, size → MasterValue,
           │                              unit GRAMS|PERCENT, quantity DECIMAL)
           ├─ LabMeasurement       (stage POST_PRESS|POST_POLISH × bodyIndex → L, a, b)
           ├─ SampleAttachment     (metadata; bytes in storage)
           └─ (SampleDesignPattern, SampleVeinMethod, designCategory … — only on samples
               saved before body-wise entry; see "Body-wise entry")

InwardOutwardEntry ─┬─ labSample (optional, unique) → LabSample (its physical sample)
                    ├─ company → MasterValue (Companies list)
                    ├─ designNameValue → MasterValue (Design Names list: Sample Design Name)
                    ├─ InwardBody (bodyIndex 1…n: designCategory) ─ InwardBodyDesignPattern
                    ├─ InwardMeasurement   (bodyIndex → L, a, b; no press/polish split)
                    ├─ Formulation (role DESIGN_ROY_BODY, bodyIndex = the body)
                    └─ (InwardDesignPattern, designCategory — older entries only)

ProductionSample ─┬─ designNameValue → MasterValue (Design Names list)
                  ├─ ProductionBody (bodyIndex 1…n: designCategory, royNumberOfBodies)
                  │     └─ ProductionBodyDesignPattern
                  ├─ ProductionMeasurement   (part MAIN: bodyIndex = the body;
                  │                           part ROY_BODY: ownerBody = the body, bodyIndex = Roy body)
                  ├─ SampleAttachment        (productionSampleId; bytes in storage)
                  └─ (ProductionDesignPattern, designCategory … — older entries only)

MasterCategory 1─* MasterValue   (label, normalizedKey, code, isActive)
User, AuditLog
```

Key decisions:

* **One formulation structure, many uses.** Main body and both Roy Body forms are `Formulation` rows distinguished by `role`; the UI is one `FormulationFields` component with a different path. A new body type is a new enum value. `bodyIndex` says which body (1 … n) a formulation belongs to.
* **No comma-separated values.** Pigments, design patterns and vein methods are child rows; "Carrara, Vein, Roy Body" is only how the register *displays* them.
* **Master data is data.** Every dropdown is a `MasterValue` in a `MasterCategory`. Uniqueness is on `(category, normalizedKey)` where the key is trimmed, space-collapsed and lower-cased — so "Glass" and " glass" cannot both exist. Values are disabled (`isActive = false`), never deleted; foreign keys use `RESTRICT` so a used value cannot vanish.
* **Behaviour by code, not label.** "ROY BODY" opens the Roy Body form because its value carries `code = ROY_BODY`. Labels can be renamed freely.
* **OTHER.** Choosing *Other* (or typing a value that is not on the list) creates the value at save time inside the same transaction. *Save to the list for future use* (ticked by default) makes it active; unticked, it is stored disabled — kept with the sample, out of everyone's dropdown, and visible under *Disabled* in Master Data.
* **Numbering.** `modules/samples/numbering.ts`: S.No. = max + 1; Slab = last sample's slab + 1, skipping numbers already taken. Saves take a PostgreSQL advisory lock so concurrent saves cannot collide; unique constraints are the final guarantee. Untouched suggestions are re-allocated at save time. Only Admin/Manager can type their own numbers.
* **Delete.** As specified, Delete removes the sample permanently (after confirmation). Its complete record is written to `AuditLog.snapshot` first, so the history survives. Every create/update/delete and master-data change is audited.
* **Files.** Bytes go through `lib/storage` (local disk now, object storage later); Postgres keeps metadata and a SHA-256 for duplicate detection. Uploads are checked for extension, size and magic bytes (a renamed .exe is rejected). Files upload immediately and are linked on save; abandoned uploads are deleted nightly by an Inngest job.
* **Validation.** One Zod schema (`modules/samples/schema.ts`) drives React Hook Form in the browser and is re-run by the server action. Nothing is mandatory except *Physical Sample Available?* on Save (not on Save Draft); what is typed must make sense (numbers numeric, n a whole number 1–20, % ≤ 100, L 0–100, a/b −128…128, no duplicate selections).
* **Prisma client** runs with `engineType = "client"` through the `pg` driver adapter: no native query engine at runtime, same code locally and on Neon.

## Phase-1 interpretations (ambiguous points in the brief)

* **Vein** is a Yes/No field; *How Vein Introduced* and *Vein details* apply unless "No vein" is chosen.
* Material rows default to one each (Resin, Grit, Filler) with *Add another* for samples that use two grits etc.
* Pigments: each selected colour gets its own quantity and unit.
* *Recent Entries* shows the 10 most recently created samples; drafts are badged.

## Inward / Outward and Rectification

* Sample Data Entry has **Physical Sample Available?** (Yes / No) in Basic Information, stored on `LabSample.physicalSamplePresent`. *Save* needs an answer (a draft does not). The page decides where to go next in `modules/samples/next-step.ts` (unit-tested).
* **Yes:** after saving, the user is taken to Inward / Outward with the form linked to that lab sample (`?sample=<id>#entry`). The entry stores `labSampleId` (one entry per sample; opening the link again goes to the existing entry's edit page; editing a sample whose physical sample is already recorded just saves).
* **No:** after saving, Inward / Outward opens at **Rectification** (third subsection, `?rectification=<id>#rectification`): a banner names the sample and its row is highlighted and badged *Awaiting physical sample · just saved*. Rectification lists every lab sample saved with No. When the sample arrives, *Sample received* opens the linked Inward form; saving it sets the flag to Yes and the sample leaves Rectification.
* **Sample Type (Creative / Inspired) was removed** from Sample Data Entry: every lab sample now uses the full body-wise form. The `LabSample.sampleTypeId` column is dropped; the retired *Sample Types* master list is hidden in Master Data and deleted by `npm run db:seed` (`RETIRED_CATEGORY_CODES` in `master-data/catalog.ts`). Reports, Dashboard and Downloads no longer split by it.
* Inward entries have their own sequential **Serial Number** (same allocation rules as S.No.). In Recent Entries, *S.No.* is the row number and *Serial Number* the entry's number, with the linked lab S.No. under it.
* **Company Name** is a master list (Companies) so the same company is never spelled two ways; new companies are added from the form exactly like OTHER values.
* **Design Name** works the same way, on one shared list (**Design Names**, Master Data): *Design Name* in Sample Data Entry and Production Sample and *Sample Design Name* in Inward / Outward are pickers over it, with *Other (type a new value)…*; a typed name that matches an existing one (ignoring case / spaces) picks it instead of creating a twin. Records point at the value (`designNameId`), so renaming it in Master Data renames it everywhere; disabling it hides it from new entries while old records keep it.
  * Names typed before the list existed stay in the old text column (Prisma field `legacyDesignName` / `legacySampleDesignName`, DB column unchanged) and are still shown everywhere. `npm run db:seed` moves them into the list (one value per name); saving such a record does the same. A list added in a newer version (like Design Names) is also created automatically the first time Master Data or a form needs it.
* Delete is permanent after confirmation, with the full record in the audit log. Deleting an inward entry does not delete the lab sample.

## Production Sample

Digital register of samples received from the production plant and their readings (`/production-sample`).

* **Form:** 1 Basic Information (Date, S. No., Slab Number, Design Name, Number of Bodies n) → 2 Bodies: for each body, Design (Plain / Non-Plain, patterns; ROY BODY opens a Roy Body form with its own n and Post Press / Post Polish L, a, b) and that body's L, a, b (Post Press / Post Polish) → 3 Sample Output (same upload / view as Sample Data Entry) → 4 Remarks → Save. Nothing is mandatory.
* **Tables:** `ProductionSample` (own S. No. / Slab Number series, unique, allocated like lab samples under advisory lock 4471003; Admins/Managers may type them), `ProductionBody` + `ProductionBodyDesignPattern` (each body's design and its Roy Body's n), `ProductionMeasurement` (`part` MAIN | ROY_BODY × `ownerBody` × stage × body; only measured rows stored), files in `SampleAttachment.productionSampleId` (a file belongs to a lab sample *or* a production sample; unlinked uploads are cleaned up when neither is set). The Roy Body's n is `royNumberOfBodies`.
* **Register** under the form: every entry, newest first, 20 per page — Date, S. No., Slab Number, Design Name, Number of Bodies, Design / Design Pattern, L, a, b Details (compact per stage · body, Roy Body underneath), Remarks (+ file count), Complete Details, Edit / Delete. Delete asks for confirmation, is permanent, and keeps the full record in the audit log; the files are removed from storage.
* Permissions `production.view / create / edit / delete / overrideNumbers / changeDate` mirror the lab-sample ones. The dashboard's *Total Production Samples* counts this register.

## Reports

* `modules/reports/build.ts` is pure aggregation (unit-tested in `tests/report-build.test.ts`); `queries.ts` loads the lab samples and production samples dated inside the window; the page passes the result to client chart components (Recharts).
* **Date basis:** the sample's Date field, last N days including today (plant time zone). Drafts count.
* **Count axes** run 0–12 as specified and grow only if a single day exceeds 12, so nothing is ever cut off.
* **Production Samples** (line chart): Production Sample register entries per date (by their Date field), zero-filled across the selected 7 / 15 / 30 days, with its own colour (`PRODUCTION_SAMPLE_COLOR`) and a *Production samples* KPI. Lab-sample charts are unaffected.
* **Design Analysis** counts a sample once per pattern; Plain Body is its own bar. A sample with no design of its own takes the one recorded on its Inward / Outward entry.
* KPIs: Samples created · Days with samples · Production samples. Charts: Sample Production and Production Samples side by side, then Design Analysis and Material Consumption. (The Creative vs Inspired chart was removed with Sample Type.)
* **Material Consumption** sums grams across every formulation of the sample (main body + Roy Bodies), stacked by material — the five largest by name, the rest folded into "Other". Quantities recorded in **%** are a share of a batch, not a weight, so they are not added; the chart shows how many were left out. A quantity with no unit is read as grams.
* Colours come from a validated colour-blind-safe palette in fixed order (`components/palette.ts`); every chart has a Table view.

## Dashboard

* Landing page (`/` → `/dashboard`). `modules/dashboard/queries.ts` computes everything from the database in one round of parallel queries.
* **Today** = samples whose Date is today in the plant time zone (`lib/plant-time.ts`), plus Inward / Outward entries created today (for designs).
* **Lab vs Line:** Line samples are not recorded yet, so every sample is a Lab sample and Line shows 0. Total Production Samples counts the Production Sample register. When Line samples are recorded, only `getDashboard()` changes.
* **Designs worked on** = design patterns (Plain Body counts as one) plus the Sample Design Names typed in Inward / Outward, merged ignoring case/spaces (`designs.ts`, unit-tested). More than 8 today → "View all designs".
* **Today:** Total Samples Made Today (Lab / Line) and Designs Worked On Today. **Overall:** Total Samples (wide), Lab, Line, Designs Worked On, Companies, Rectification Cases, Production Samples.
* **Total Companies** = active values in the Companies master list. **Rectification** = lab samples with Physical Sample Available? = No (the Rectification list in Inward / Outward).
* **Forum** (`modules/forum`, shown on the dashboard): a discussion / task board.
  * **Posts** (`Announcement` table — name kept so earlier announcements carry over): Type (Announcement, Today's Task, Sample Instruction, Query, Production Instruction, Other), Title, Message, Priority (Normal / Important — Important is pinned and marked red), Status (Open / In Progress / Completed), Posted by, date & time. Lab Head / Plant Head / CEO post (`forum.post` = Manager, Admin); the author or an Admin edits or removes. Removing archives the post — never deleted.
  * **Replies** (`ForumReply`): Lab and R&D users reply under a specific post (`forum.reply` = Operator, Manager, Admin). Each reply records who and when; the thread reads oldest → newest under its post, the latest 3 are shown with "Show earlier replies" for the rest. A reply by the post's author is tagged *Author*. Removing a reply hides it (`isDeleted`), it stays on record.
  * **Status** can be changed from the post itself (`forum.status` = Operator, Manager, Admin); every change is written to the audit log. The status chips filter the list.
  * **Order:** open work first — Important pinned, then by latest activity (`lastActivityAt` moves forward with every reply) — then completed posts. The banner at the top of the dashboard shows the leading open post with its reply count.
  * **Who is posting:** sign-in is off, so the poster / replier types their name; it is remembered on that computer (browser storage, key `lab-erp:forum-name`) and shown as "Replying as … · Change". When sign-in returns, drop `authorName` from `modules/forum/schema.ts` and the actions fall back to the signed-in user's name (`createdBy`) — already done for older posts.
  * **Extending:** more priority levels → swap `important` for an enum and extend `POST_PRIORITY_LABEL` in `kinds.ts`; more statuses → add to the `PostStatus` enum and `POST_STATUS_LABEL`; attachments → a `ForumAttachment` table pointing at a post or reply, using the same storage driver and `/api/uploads` flow as sample files.

## Downloads (Excel)

* One endpoint, `GET /api/downloads?kind=…&period=…[&type&design&pattern]`, builds the workbook with ExcelJS (`modules/downloads/excel.ts`) and returns only the records of that Production Date (and filters). Viewer role and up can download.
* **Production Date** (every subsection): a dropdown — **All** (`period=all`: every record dated from the beginning up to today), **Date Wise** (`period=date&date=…`: one calendar), **Date Range** (`period=range&from=…&to=…`: From and To, both inclusive). `modules/downloads/period.ts` is the one place this is defined (parse, validate, label, file name, Prisma filter), used by the forms, the record counts, the page and the Excel route, so the count shown, the on-screen results and the file always hold the same records. A reversed or incomplete range is stopped in the form; the API answers 400 to a missing date. File names carry the period (`…_2026-10-06`, `…_2026-09-28_to_2026-10-03`, `…_All_upto_2026-10-06`). Records come oldest date first.
* **Date meaning:** each record's own Date field — Data Entry samples, Inward / Outward entries and Production Samples alike.
* **Data Entry Sample:** one row per sample with every form field, grouped under two-row headers (Basic Information, Material Choices, Design, Roy Body — Design, Mixer & Vein, Roy Body — Vein, L a b Post Press / Post Polish with one column per body, Output & Record). Extra sheets: *Formulation Detail* (one row per component, numeric quantity) and *L a b* (one row per reading).
* **Inward / Outward Sample:** same idea for the inward form.
* **Complete Sample Report:** one row per lab sample with its linked Inward / Outward entry beside it, plus inward entries recorded that day that are not already on a row; column groups are prefixed "Data Entry ·" / "Inward / Outward ·".
* **Production Sample Data Download** (`kind=production`, subsection 2): the Production Date and *Download Excel* — no type to choose. One row per production sample of the period (by its Date field), in form order: Basic Information, Design, Roy Body — Design (n, and its Post Press / Post Polish L, a, b when any entry of the day has a Roy Body), L, a, b Post Press / Post Polish (one column per body), Output Files & Remarks, Record. Extra sheet *L a b* lists every reading. Needs `production.view` as well as `downloads.view`.
* **Filtered Data Export:** filters live in the URL (`/downloads?apply=1&period=…&type&design&pattern`), so Apply, the on-screen results and the Excel use the same query and always match. Filters: Production Date, **Sample Type** (**Lab Samples** — Sample Data Entry · **Production Samples**; *All sample types* includes both), Design, Design Pattern. A lab sample without a design of its own uses the one on its Inward entry; production samples use their own. Older links with `type=CREATIVE` / `INSPIRED` read as all sample types. The file has the summary sheet (one row per matching record, lab or production, with its Sample Type), *Sample Details* (full Data Entry columns, when lab samples are asked for), *Production Sample Details* (full Production Sample columns, when production samples are asked for) and a *Filters Applied* sheet. (The Material Consumption / Material filters were removed.)
* Filter and period logic are pure and unit-tested (`tests/download-filters.test.ts`, `tests/download-period.test.ts`).

## Sign-in (off for now)

Authentication was removed at the client's request. `lib/session.ts` returns one built-in Admin user (created on first use from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME`), so "created by" stays meaningful. Permission checks (`can()` / `requirePermission()`) are unchanged and still run on every action; with the Admin role they all pass. Re-enabling sign-in = making `currentUser()` read a session again (e.g. Auth.js v5 credentials) and adding a login page; the `User.passwordHash` / `role` columns are already there.

## Quantities are grams only

The Measurement (unit) dropdowns were removed from every formulation (Resin, Grits, Filler, Pigment, all Roy Body forms). Every quantity is entered as **Quantity (gm)** and saved with unit `GRAMS`. The `unit` column stays in the database so values recorded in % before this change keep their meaning; they are shown as "30 %" and are not added into gram totals.

## Body-wise entry (Number of Bodies)

Number of Bodies (n) opens one complete section per body in every data-entry form; anything recorded once per record follows after the bodies.

| Form | Each body | Once, after the bodies |
|---|---|---|
| Sample Data Entry | Material Choices & Pigments · Design (+ Roy Body) · Vein (+ Mixer Type, + Roy Body) · L, a, b (Post Press / Post Polish) | Sample Output (files + Remarks) |
| Inward / Outward | Design Pattern (+ Roy Body) · L, a, b | Lab Recreation Attempts |
| Production Sample | Design (+ Roy Body: n + L, a, b) · L, a, b (Post Press / Post Polish) | Sample Output · Remarks |

* Each body keeps the existing fields and conditional logic (ROY BODY opens the Roy Body form inside *that* body's Design; Vein No hides that body's methods / details). The Roy Body form itself is unchanged — its own n still only sets its L, a, b rows.
* UI: `components/lab/BodySections.tsx` (Body 1 … n cards with a jump bar; a body with an error opens and stays open), `BodyPart`, `BodyLabFields`; `DesignFields` and `VeinFields` take a `prefix` (`bodies.i.`). `useBodyRows()` keeps the `bodies` array at n, adding new empty bodies and never touching what is typed. Read-only: `components/lab/BodyView.tsx`.
* Validation: `sampleBodySchema`, `inwardBodySchema`, `productionBodySchema` per body; duplicate patterns / methods are flagged per body; errors carry the body path (`bodies.1.main.resins.0.quantity`).
* Summaries across bodies (`modules/samples/bodies.ts`, unit-tested): registers show "Plain Body" when all bodies agree, else "Body 1: Plain Body · Body 2: ROY BODY"; Filtered Export matches a record when **any** body has the chosen design / pattern; Reports' Design Analysis and the Dashboard count each design once per record across its bodies; Mixer Type / How Vein Introduced are listed across bodies.
* Excel: one column group per body (`Body 1 · Material Choices & Pigments`, `Body 1 · Design`, `Body 1 · Roy Body …`, `Body 1 · Vein`, `Body 1 · L, a, b`, then Body 2 …); the *Formulation Detail* and *L a b* sheets name the body on every line.
* **Records saved before body-wise entry** have no body rows. They are read with their one Material / Design / Vein (and Roy Body) **copied onto every body** (n bodies, or 1 when n was blank), each body keeping its own L, a, b; the detail page says so. Editing and saving such a record writes real body rows (the copies become each body's own values) and clears the record-level columns. No data migration is needed.

## Roy Body (from Design) is a complete body

When ROY BODY is picked under Design (Sample Data Entry and Inward / Outward), the Roy Body form has, in order: **Number of Bodies (n)** → **Material Choices & Pigments** (Resin, Grits, Filler, Pigments, all Quantity (gm)) → **Vein** (Vein Yes/No, Mixer Type, How Vein Introduced, Vein details, and — when ROY BODY is one of its methods — a nested Roy Body formulation) → **L, a, b Values** (Post Press / Post Polish, one row per body of the Roy Body's own n).

Storage: the Roy Body stays one `Formulation` row (role `DESIGN_ROY_BODY`) with extra columns `numberOfBodies`, `hasVein`, `veinNotes`, `mixerTypeId`; its vein methods are `FormulationVeinMethod` rows, its readings `FormulationMeasurement` rows, and the nested vein Roy Body is a child `Formulation` (`parentId`, role `VEIN_ROY_BODY`). Everything cascades with the sample / entry. UI: `components/lab/RoyBodyFields.tsx` and the shared `VeinFields.tsx` (the main Vein section uses the same component); server: `writeRoyBody()` in `modules/formulation/service.ts`. Material consumption (Reports, Downloads) includes the nested Roy Body's quantities.

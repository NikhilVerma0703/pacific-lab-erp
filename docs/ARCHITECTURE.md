# Lab ERP — Architecture

## Folder layout

```
prisma/schema.prisma        data model (single source of truth)
prisma/seed.ts              master lists + first admin (idempotent)
src/
  app/
    (app)/                  app shell (sidebar, mobile menu)
      samples/              Sample Data Entry (rebuilt Lab Sample form + Recent Entries, ?page=) · /[id] Review · /[id]/edit
      inward-outward/       Inward / Outward (rebuilt form + register, ?page=, rectification) · /[id] Review · /[id]/edit
      production-sample/    Production Sample (rebuilt form + register, ?page=) · /[id] Review · /[id]/edit
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
    forms/                  shared by the rebuilt forms: fields.ts (Zod building blocks),
                            design-types.ts + design.ts (Plain Body / design types /
                            shared N), design-server.ts (types as Design Patterns),
                            materials.ts (Material Details of a body)
    samples/                Lab Sample (rebuilt): schema, numbering, service, queries
                            (detail, prefill, Recent Entries), actions, components
                            (form, Recent Entries, Review, files), bodies helpers
    inward-outward/         Inward / Outward (rebuilt): schema, numbering,
                            service, queries (detail + paged register), actions,
                            components (form, register, Review), Rectification
    production/             Production Sample (rebuilt): schema, numbering, service,
                            queries (detail + paged register), actions, components
    formulation/            formulationInclude (reading saved formulations)
    forum/                  Forum posts + threaded replies: kinds, schema (Zod),
                            queries, actions, components
    master-data/            catalog (seeded lists + behaviour codes), service,
                            actions, components
  components/ui/            Field, FormSection, Dialog/ConfirmDialog, Segmented,
                            ChoiceChips (multi-select buttons),
                            MasterPicker (searchable single/multi + OTHER)
  components/forms/         blocks of the rebuilt forms: BodyReadingsFields
                            (+ useBodyCount), BodyReadingsView, ReadingRowsFields /
                            ReadingRowsView (one L, a, b per row), StageRowsFields /
                            StageRowsView (Post Press + Post Polish per row),
                            MaterialDetailsFields / MaterialsView, ColourQuantityFields,
                            VeinTypeFields (Kreos / Vein), errorAt
  components/lab/           read-only views of records of the earlier forms:
                            FormulationView, RoyBodyView
  lib/                      db, permissions, session, audit, storage, uploads,
                            normalize, utils
```

Adding a section later = one entry in `modules/registry.ts` + `app/(app)/<route>` + `modules/<name>/`. Adding a permission = one line in `lib/permissions.ts`.

## Data model

```
LabSample ─┬─ designNameValue → MasterValue (Design Names list)
           ├─ designCategory       (Plain Body – Yes → PLAIN_BODY, No → NON_PLAIN_BODY)
           ├─ SampleDesignDetail   (one per selected design type: ROY_BODY | KREOS | CARRARA |
           │     │                  VEIN | CHESSBOARD; bodyCount n for Roy / Chessboard;
           │     │                  veinPresent + mixerType for Kreos / Vein)
           │     ├─ SampleDesignVeinDetail → MasterValue (Vein Details list)
           │     └─ SampleDesignColour     → MasterValue (Pigments list) + quantity (gm)
           ├─ SampleDesignPattern  (the selected types as Design Patterns values)
           ├─ SampleBody (bodyIndex 1…N: designCategory + patterns = the sample's design;
           │     │        mixerType, hasVein, vein methods / details — earlier form only)
           │     ├─ SampleBodyDesignPattern (body × pattern)
           │     ├─ SampleBodyVeinDetail    (body × Vein Details value)
           │     └─ SampleBodyVeinMethod    (body × method)
           ├─ Formulation (role MAIN_BODY = Material Details of Body i; ROY_BODY / CHESSBOARD_BODY
           │     │        = Roy / Chessboard Body k; DESIGN_ROY_BODY / VEIN_ROY_BODY = earlier form)
           │     ├─ FormulationComponent (kind: RESIN | GRIT | FILLER | PIGMENT,
           │     │                        material → MasterValue, size → MasterValue (Grit Sizes),
           │     │                        unit GRAMS|PERCENT, quantity DECIMAL)
           │     ├─ FormulationAdditive  (additive → MasterValue (Additives list), quantity)
           │     └─ FormulationVeinDetail (earlier form's Roy Body × Vein Details value)
           ├─ LabMeasurement       (part MAIN | ROY_BODY | CHESSBOARD × stage POST_PRESS|POST_POLISH
           │                        × bodyIndex → L, a, b)
           ├─ SampleAttachment     (metadata; bytes in storage)
           └─ (SampleVeinMethod, mixerType, hasVein, physicalSamplePresent … — samples of the
               earlier forms; see "Body-wise entry")

InwardOutwardEntry ─┬─ labSample (optional, unique) → LabSample (its physical sample)
                    ├─ company → MasterValue (Companies list)
                    ├─ designNameValue → MasterValue (Design Names list: Sample Design Name)
                    ├─ designCategory      (Plain Body – Yes → PLAIN_BODY, No → NON_PLAIN_BODY)
                    ├─ InwardDesignDetail  (one per selected design type: ROY_BODY | KREOS |
                    │    │                  CARRARA | VEIN | CHESSBOARD; bodyCount n for Roy /
                    │    │                  Chessboard; veinPresent + mixerType for Kreos / Vein)
                    │    ├─ InwardDesignVeinDetail → MasterValue (Vein Details list)
                    │    └─ InwardDesignColour     → MasterValue (Pigments list) + quantity (gm)
                    ├─ InwardDesignPattern (the selected types as Design Patterns values)
                    ├─ InwardMeasurement   (part MAIN | ROY_BODY | CHESSBOARD × bodyIndex → L, a, b)
                    ├─ SampleAttachment    (inwardEntryId — Sample Output files)
                    └─ (InwardBody ─ InwardBodyDesignPattern, Formulation DESIGN_ROY_BODY —
                        entries saved with the earlier form only)

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
* **Master data is data.** Every dropdown is a `MasterValue` in a `MasterCategory`. Uniqueness is on `(category, normalizedKey)` where the key is trimmed, space-collapsed and lower-cased — so "Glass" and " glass" cannot both exist.
* **Text values are case-insensitive everywhere** (`lib/normalize.ts`: `normalizeKey`, `sameText`, `compareLabels`). `qwety`, `Qwety` and `qwetY` are one value for searching (pickers, Master Data search), filtering, duplicate checks (pickers, form validation, Master Data add / rename, the database's unique key), picking (typing a listed value in any case picks it; a typed new value is offered once, whatever its case) and database matching (forms save by key, so no list ever gets a twin). Summaries, Reports and the Dashboard merge by the same key and keep the first spelling; lists sort alphabetically ignoring case. `npm run db:seed` (and the first start of a new version) also re-checks every stored key. Values are disabled (`isActive = false`), never deleted; foreign keys use `RESTRICT` so a used value cannot vanish.
* **Behaviour by code, not label.** "ROY BODY" opens the Roy Body form because its value carries `code = ROY_BODY`. Labels can be renamed freely.
* **OTHER.** Choosing *Other* (or typing a value that is not on the list) creates the value at save time inside the same transaction. *Save to the list for future use* (ticked by default) makes it active; unticked, it is stored disabled — kept with the sample, out of everyone's dropdown, and visible under *Disabled* in Master Data.
* **Numbering.** `modules/samples/numbering.ts`: S.No. = max + 1; Slab = last sample's slab + 1, skipping numbers already taken. Saves take a PostgreSQL advisory lock so concurrent saves cannot collide; unique constraints are the final guarantee. Untouched suggestions are re-allocated at save time. Only Admin/Manager can type their own numbers.
* **Delete.** As specified, Delete removes the sample permanently (after confirmation). Its complete record is written to `AuditLog.snapshot` first, so the history survives. Every create/update/delete and master-data change is audited.
* **Files.** Bytes go through `lib/storage` (local disk now, object storage later); Postgres keeps metadata and a SHA-256 for duplicate detection. Uploads are checked for extension, size and magic bytes (a renamed .exe is rejected). Files upload immediately and are linked on save; abandoned uploads are deleted nightly by an Inngest job.
* **Validation.** One Zod schema per form (e.g. `modules/samples/schema.ts`) drives React Hook Form in the browser and is re-run by the server action on what the form shows. Nothing is mandatory; what is typed must make sense (numbers numeric, counts whole numbers 1–20, quantities ≥ 0, L 0–100, a/b −128…128, no duplicate selections).
* **Prisma client** runs with `engineType = "client"` through the `pg` driver adapter: no native query engine at runtime, same code locally and on Neon.

## Phase-1 interpretations (ambiguous points in the brief)

* **Vein** is a Yes/No field. A body whose Design is **Plain Body** has no Vein at all — the whole Vein part disappears. **Mixer Type** shows only with Vein = *Yes*; *How Vein Introduced* and *Vein details* apply unless *No vein* is chosen. The same rules hold inside every Roy Body. What a form hides is neither validated nor saved (`visibleSampleInput` / `visibleInwardInput` in the browser and in the server action, and again when writing). A record saved earlier with a Mixer Type but no Vein answer opens with Vein = Yes, so its Mixer Type is kept.
* **Vein details** work like *Color Used*: a searchable multi-select over the **Vein Details** list (Master Data), with *Other (type a new value)…*; values up to 200 characters. Rows: `SampleBodyVeinDetail` (each body) and `FormulationVeinDetail` (each Roy Body). Text typed before the list existed (`veinNotes` column, Prisma `legacyVeinNotes`) is moved into the list — one value per text, ignoring case — the first time the app runs after the update (or by `npm run db:seed`), so every earlier detail is offered as an option; the old one-text-per-sample details of pre-body samples are added to the list too and become body rows on the next save.
* Material rows default to one each (Resin, Grit, Filler) with *Add another* for samples that use two grits etc.
* Pigments: each selected colour gets its own quantity and unit.
* *Recent Entries* lists every lab sample, newest first, 20 per page; drafts of the earlier form are badged. Its **Review** column (also in the Inward / Outward and Production Sample registers and Rectification) opens the complete record.

## Inward / Outward and Rectification

* *(Earlier Lab Sample form — not part of the rebuilt form; see "Lab Sample (rebuilt)".)* Sample Data Entry had **Physical Sample Available?** (Yes / No) in Basic Information, stored on `LabSample.physicalSamplePresent`; saved values are kept and still drive Rectification.
* **Yes:** after saving, the user is taken to Inward / Outward with the form linked to that lab sample (`?sample=<id>#entry`). The entry stores `labSampleId` (one entry per sample; opening the link again goes to the existing entry's edit page; editing a sample whose physical sample is already recorded just saves).
* **No:** after saving, Inward / Outward opens at **Rectification** (third subsection, `?rectification=<id>#rectification`): a banner names the sample and its row is highlighted and badged *Awaiting physical sample · just saved*. Rectification lists every lab sample saved with No. When the sample arrives, *Sample received* opens the linked Inward form; saving it sets the flag to Yes and the sample leaves Rectification.
* **Sample Type (Creative / Inspired) was removed** from Sample Data Entry: every lab sample now uses the full body-wise form. The `LabSample.sampleTypeId` column is dropped; the retired *Sample Types* master list is hidden in Master Data and deleted by `npm run db:seed` (`RETIRED_CATEGORY_CODES` in `master-data/catalog.ts`). Reports, Dashboard and Downloads no longer split by it.
* Inward entries have their own sequential **S.No.** and **Slab Number** (same allocation rules as the lab S.No.). In the register an older entry shows its linked lab S.No. under its own.
* **Company Name** is a master list (Companies) so the same company is never spelled two ways; new companies are added from the form exactly like OTHER values.
* **Design Name** works the same way, on one shared list (**Design Names**, Master Data): *Design Name* in Sample Data Entry and Production Sample and *Sample Design Name* in Inward / Outward are pickers over it, with *Other (type a new value)…*; a typed name that matches an existing one (ignoring case / spaces) picks it instead of creating a twin. Records point at the value (`designNameId`), so renaming it in Master Data renames it everywhere; disabling it hides it from new entries while old records keep it.
  * Names typed before the list existed stay in the old text column (Prisma field `legacyDesignName` / `legacySampleDesignName`, DB column unchanged) and are still shown everywhere. `npm run db:seed` moves them into the list (one value per name); saving such a record does the same. A list added in a newer version (like Design Names) is also created automatically the first time Master Data or a form needs it.
* Delete is permanent after confirmation, with the full record in the audit log. Deleting an inward entry does not delete the lab sample.

## Production Sample (rebuilt)

Digital register of samples received from the production plant and their readings (`/production-sample`). Rebuilt from scratch in October 2026 (see "Forms rebuild").

* **Form** (`modules/production/components/ProductionForm.tsx`):
  1. **Basic Information** — exactly five fields: Date, S.No., Slab Number, Design Name (Design Names list, with *Other…*), Number of Bodies (N).
  2. **L, a, b Measurements** — one block per body, generated from N: *Body i* → Post Press (L, a, b) and Post Polish (L, a, b). Lowering N hides the higher bodies but keeps what was typed in them until the form is saved, so raising N brings it back; only Body 1 … N are validated and saved (`visibleProductionInput`, in the browser and in the server action).
  3. **Sample Output** — files, same upload / view as before.
  4. **Remarks** — same as before.
  Then **Save**, and the **Production Sample Register** under the form. Nothing is mandatory; L must be 0–100, a and b −128…128, N a whole number 1–20.
* **Schema / save:** `modules/production/schema.ts` (Zod, built from `modules/forms/fields.ts`), `service.ts` (`saveProductionSample` — one transaction: numbers under advisory lock 4471003, Basic Information, readings as `ProductionMeasurement` rows `part MAIN` × stage × body, files, audit log).
* **Tables:** `ProductionSample` (own S.No. / Slab Number series, unique; Admins/Managers may type them), `ProductionMeasurement`, files in `SampleAttachment.productionSampleId`. Entries saved with the earlier form may also have a Design per body (`ProductionBody`, `ProductionBodyDesignPattern`, Roy Body readings `part ROY_BODY`): the rebuilt form does not show it; saving such an entry keeps it for Body 1 … N (Downloads still export it) and removes it for bodies above N.
* **Register:** every entry, newest first, 20 per page — Date, S.No., Slab Number, Design Name, Number of Bodies, L, a, b Details (Body i · Post Press / Post Polish), Remarks (+ file count), Review, Edit / Delete. Delete asks for confirmation, is permanent, keeps the full record in the audit log and removes the files from storage.
* **Review page** (`/production-sample/[id]`): the same four parts, read-only. **Edit** (`/production-sample/[id]/edit`) opens the form filled in.
* Permissions `production.view / create / edit / delete / overrideNumbers / changeDate`. The dashboard's *Total Production Samples* counts this register.

## Forms rebuild (October 2026)

The three data-entry forms are being rebuilt from scratch, one by one, to new specifications.

| Form | State |
|---|---|
| Production Sample | **Rebuilt** (above). |
| Lab Sample (Sample Data Entry, `/samples`) | **Rebuilt** (below). |
| Sample Inward / Outward (`/inward-outward`) | **Rebuilt** (below). |

* Saved records of all three stay in the database; the **Dashboard, Reports, Downloads and Master Data are unchanged** and keep using them (their read models — `samples/queries.ts`, `inward-outward/queries.ts`, `production/queries.ts` `ProductionDetail`, and the `*Include` objects in each `service.ts` — were kept).
* Shared building blocks for the rebuilt forms: `modules/forms/` (`fields.ts`, `design-types.ts`, `design.ts`, `design-server.ts`, `materials.ts`) and `components/forms/` (body readings, reading rows, Post Press / Post Polish rows, Material Details, colours with quantities, Kreos / Vein fields and their read-only views).
* The sections further below that describe the earlier forms (body-wise entry, Vein rules, Roy Body, Physical Sample Available?, Rectification) document how their saved records are read.

## Lab Sample (rebuilt)

Sample Data Entry (`/samples`). Rebuilt from scratch in October 2026.

* **Form** (`modules/samples/components/LabSampleForm.tsx`), one numbered section each:
  1. **Basic Information** — Date, S.No., Slab Number, Design Name (Design Names list, with *Other…*).
  2. **Design Type and Number of Bodies** — **Plain Body – Yes / Plain Body – No**; with No, multi-select **Roy Body, Kreos, Carrara, Vein, Chessboard**. **Number of Bodies (N)** once, shared by every type, as soon as Yes or at least one type is chosen.
  3. **Material Details** — one collapsible card per body (Body 1 … N): **Material Choices** — Resin (+ Quantity (gm)), Grits (+ Size of Grit, Quantity (gm)), Filler (+ Quantity (gm)), one row each with *Add another …*; **Pigments / Additives Details** — Pigments: *Color Used* (multi) and Additives: *Additives Used* (multi), each picked value with its Quantity (gm).
  4. One section per selected type, in that order: **Roy Body Details** (Number of Roy Body (n) + Material Details of Roy Body 1 … n) · **Kreos Vein Details** (Vein Present – Yes / No; with Yes Mixer Type — Grit, Filler, Pure, *Other…* —, Vein Details, Kreos Vein Colors Used with Quantity (gm)) · **Carrara Details** (Carrara Colors Used with Quantity (gm)) · **Vein Details** (as Kreos, with *Vein Colors Used*) · **Chessboard Details** (Number of Chessboard Body (n) + Material Details of each).
  5. **L, a, b Measurements** — once: one row per body (Body 1 … N, then Roy Body 1 … n and Chessboard Body 1 … n), two column groups **Post Press** (L, a, b) and **Post Polish** (L, a, b).
  6. **Sample Output**, 7. **Remarks** — once; then one **Save**.
* **Linked to Sample Inward / Outward** (the master of existing physical samples; `samples/inward-link.ts`, read from the Sample Inward / Outward Database): the **Design Name** dropdown lists the Design Names saved in Inward / Outward (a new name can still be typed). Once a name is picked or typed, a panel under Basic Information lists every saved design of that name — one line per design, e.g. *A – Plain Body*, *A – Roy Body + Carrara* (the latest entry of each design, with N, S.No. and date). **Use** fills Design Type (Plain Body / design types), Number of Bodies (N), Number of Roy / Chessboard Body (n) and puts that entry's L, a, b readings into **Post Polish** (Post Press left empty) — only from that one design, never mixing designs; everything stays editable and *Undo* in the message restores the form. The inward records are only read; the lab sample is saved on its own. No match → the form is filled in by hand as usual.
* **Resin, Grits, Size of Grit, Filler, Additives** are typed or picked: the lists (Resins, Grits, Grit Sizes, Fillers, Additives) start empty on a new install and grow with what is entered (*+ Add “…”* / *Other…*, saved to the list by default). The same name in another letter case picks the existing value. The same resin / filler / additive / colour twice in one body, or the same grit with the same size, is flagged; a quantity or size without its material is flagged.
* **Only what is shown is validated and saved** (`labLayout` = `designLayout` and `visibleLabInput`): as for Inward / Outward, plus Material Details and readings beyond N / n are ignored. Hidden values stay in the form until saved.
* **Save** (`service.ts` `saveLabSample`, one transaction, advisory lock 4471001): numbers, Basic Information, design (`designCategory`, `SampleDesignDetail` + vein details + colours, each type also as its Design Patterns value on the sample and on every body `SampleBody` 1 … N — that is what the Dashboard, Reports and Downloads read), Material Details as formulations (`MAIN_BODY` i, `ROY_BODY` k, `CHESSBOARD_BODY` k; components + `FormulationAdditive`), readings (`LabMeasurement` part × stage × body), files, audit log. Status is always *Saved*.
* **Recent Entries** under the form: every sample, newest first, 20 per page — Date, S.No., Slab Number, Design Name, Design, Number of Bodies, Remarks (+ files), **Review**, Edit / Delete (confirmation; files removed; audit log keeps the record; a linked Inward / Outward entry stays).
* **Review** (`/samples/[id]`): the same sections. **Edit** (`/samples/[id]/edit`) opens the form filled in.
* **Samples of the earlier forms** open in the new form with what maps onto it: Plain Body / design types from their design, Material Details from each body's materials (a sample saved before body-wise entry had one set of materials — it opens on Body 1, so Reports do not count it N times), readings. Saving keeps what the new form does not show — Physical Sample Available? and the linked Inward / Outward entry, each body's Vein (Mixer Type, How Vein Introduced, Vein details), the Roy Body formulations of Body 1 … N, design patterns that are not design types — and shows it on the Review page under *Recorded with the earlier form*. A per-body design (Body 1 Plain, Body 2 Roy Body) becomes the one design chosen on the form.
* **Physical Sample Available?** is not part of the rebuilt form, so new lab samples are not sent to Rectification; samples saved earlier with No stay listed there.
* **Downloads / Reports / Dashboard** are unchanged and read new samples through `SampleDetail`: Design Name, design (Plain / Non-Plain + types as patterns), Body 1 … N materials (Resin, Grits, Filler, Pigments) and Post Press / Post Polish readings; Reports' material consumption counts every formulation (bodies, Roy and Chessboard bodies). Additives, the types' own fields and Roy / Chessboard body readings are not in the Excel files yet.

## Sample Inward / Outward (rebuilt)

Physical samples received from companies (`/inward-outward`). Rebuilt from scratch in October 2026.

* **Form** (`modules/inward-outward/components/InwardForm.tsx`):
  1. **Sample Details** — Date, S.No., Slab Number, Company Name, Design Name (Companies / Design Names lists, with *Other…*).
  2. **Design Type and Bodies** — buttons **Plain Body – Yes / Plain Body – No**.
     * **Yes:** Number of Bodies (N).
     * **No:** multi-select buttons **Roy Body, Kreos, Carrara, Vein, Chessboard** (`design-types.ts`). Each selected type gets its own subsection, always in that order:
       * *Roy Body* — Number of Roy Body (n). *Chessboard* — Number of Chessboard Body (n).
       * *Kreos* — **Kreos Vein Details**: Vein Present – Yes / No; with Yes: Mixer Type (Mixer Types list: Grit, Filler, Pure, *Other…*), Vein Details (Vein Details list, multi), **Kreos Vein Colors Used** (Pigments list, multi, *Other…*) with a Quantity (gm) per colour.
       * *Vein* — the same, titled **Vein Details** / **Vein Colors Used**.
       * *Carrara* — **Carrara Colors**: Carrara Colors Used (multi, *Other…*) with Quantity (gm) per colour.
     * **Number of Bodies (N)** appears **once**, as soon as Yes or at least one type is chosen, and is shared by every selected type.
  3. **L, a, b Measurements** — one L, a, b reading per row: *Bodies* (Body 1 … N, once), then *Roy Bodies* (Roy Body 1 … n) and *Chessboard Bodies* (Chessboard Body 1 … n) when those types are selected.
  4. **Sample Output** and 5. **Remarks** — once; then a single **Save**.
* **Only what is shown is validated and saved** (`inwardLayout` + `visibleInwardInput` in `schema.ts`, run in the browser and in the server action): Plain Body – Yes drops the design types; an unselected type drops its fields; Vein Present – No drops Mixer Type, Vein Details and colours; readings beyond N / n are ignored. Hidden values stay in the form until saved, so switching back brings them back. Nothing is mandatory; counts are whole numbers 1–20, quantities ≥ 0, L 0–100, a / b −128…128; the same colour twice (ignoring case) is flagged.
* **Save** (`service.ts` `saveInward`, one transaction): S.No. and Slab Number from their own series under advisory lock 4471002 (Admins / Managers may type them; Slab Number is unique among inward entries); company / design name values (new ones added to the lists when *Save to the list* is ticked); one `InwardDesignDetail` per type (+ vein details and colours), each type also stored as its Design Patterns value (`InwardDesignPattern`, matched by code) so the Dashboard, Reports and Downloads keep counting it; readings as `InwardMeasurement` rows by part; files; audit log.
* **Register** under the form: 20 per page, newest first — Date, S.No. (with the linked Lab S.No. for older entries), Slab Number, Company Name, Design Name, Design (Plain Body / the selected types), Number of Bodies, Remarks (+ file count), Review, Edit / Delete (with confirmation; files removed from storage; audit log keeps the record). **Rectification** follows, read-only with Review.
* **Review** (`/inward-outward/[id]`): the same five parts. Entries saved with the earlier form also show *Recorded with the earlier form* (linked lab sample, design per body, Lab Recreation Attempts, Roy Body formulation). **Edit** (`/inward-outward/[id]/edit`) opens the form filled in; for an earlier entry Plain Body and the design types are derived from its per-body design. Saving such an entry replaces the per-body design with the types chosen on the form and keeps the Roy Body formulation for Body 1 … N.
* **Downloads:** unchanged — the inward Excel keeps its columns; new entries fill Date, S.No., company, design name, N, design (Plain Body / Non-Plain Body + types as patterns) and the L, a, b of Body 1 … N. Roy / Chessboard body readings, colours and vein details are not in the Excel yet.

## Lab Sample and Sample Inward / Outward databases

Besides the forms' own tables (which the registers, Review pages, Dashboard, Reports and Downloads read), every saved record is also stored in its form's separate database table:

* **Lab Sample Database** — `LabSampleRecord` (one row per lab sample).
* **Sample Inward / Outward Database** — `InwardOutwardRecord` (one row per entry). It is the reference for existing physical samples.

Each row has the main fields as columns (S.No., Slab Number, date, Design Name + id, Plain Body, design types, Number of Bodies, company for inward) and `data` (JSON) — the complete record as the Review page shows it (`SampleDetail` / `InwardDetail`: design types with their fields, Material Details of every body, Roy / Chessboard bodies, all L, a, b readings, file metadata, remarks, what an earlier form recorded; every list value with its id). The row is written inside the same save transaction (`samples/record-store.ts`, `inward-outward/record-store.ts`), so it is always in step; it is removed with the record (deleting a lab sample also refreshes the copy of its linked inward entry). `formVersion` marks the shape of `data`. Records saved before these tables existed — or changed outside the forms — are copied on the first page visit after a server start (`modules/records/sync.ts`).

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
* **Designs Worked On Today** = the Design Names recorded today — *Design Name* of lab samples and *Sample Design Name* of Inward / Outward entries dated today — each once, merged ignoring case/spaces (`designs.ts`, unit-tested). Design / Design Pattern values are **not** counted here. More than 8 → "View all designs".
* **Total Designs Worked On** (overall) = design patterns (Plain Body counts as one) plus the Design Names used by lab samples and Inward / Outward entries, merged the same way.
* **Today:** Total Samples Made Today (Lab / Line) and Designs Worked On Today. **Overall:** Total Samples, Total Lab Samples, Total Line Samples, Total Designs Worked On, Total Production Samples. (Total Companies and Total Rectification Cases were removed; Rectification is still listed in Inward / Outward.)
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

* Each body keeps the existing fields and conditional logic (ROY BODY opens the Roy Body form inside *that* body's Design; Plain Body hides that body's Vein; No vein hides its Mixer Type, methods and details). The Roy Body form itself is unchanged — its own n still only sets its L, a, b rows.
* UI: `components/lab/BodySections.tsx` (Body 1 … n cards with a jump bar; a body with an error opens and stays open), `BodyPart`, `BodyLabFields`; `DesignFields` and `VeinFields` take a `prefix` (`bodies.i.`). `useBodyRows()` keeps the `bodies` array at n, adding new empty bodies and never touching what is typed. (Removed in the October 2026 rebuild.)
* Validation: `sampleBodySchema`, `inwardBodySchema`, `productionBodySchema` per body; duplicate patterns / methods are flagged per body; errors carry the body path (`bodies.1.main.resins.0.quantity`).
* Summaries across bodies (`modules/samples/bodies.ts`, unit-tested): registers show "Plain Body" when all bodies agree, else "Body 1: Plain Body · Body 2: ROY BODY"; Filtered Export matches a record when **any** body has the chosen design / pattern; Reports' Design Analysis and the Dashboard count each design once per record across its bodies; Mixer Type / How Vein Introduced are listed across bodies.
* Excel: one column group per body (`Body 1 · Material Choices & Pigments`, `Body 1 · Design`, `Body 1 · Roy Body …`, `Body 1 · Vein`, `Body 1 · L, a, b`, then Body 2 …); the *Formulation Detail* and *L a b* sheets name the body on every line.
* **Records saved before body-wise entry** have no body rows. They are read with their one Material / Design / Vein (and Roy Body) **copied onto every body** (n bodies, or 1 when n was blank), each body keeping its own L, a, b; the detail page says so. Editing and saving such a record writes real body rows (the copies become each body's own values) and clears the record-level columns. No data migration is needed.

## Roy Body (from Design) is a complete body

When ROY BODY is picked under Design (Sample Data Entry and Inward / Outward), the Roy Body form has, in order: **Number of Bodies (n)** → **Material Choices & Pigments** (Resin, Grits, Filler, Pigments, all Quantity (gm)) → **Vein** (Vein Yes/No, Mixer Type, How Vein Introduced, Vein details, and — when ROY BODY is one of its methods — a nested Roy Body formulation) → **L, a, b Values** (Post Press / Post Polish, one row per body of the Roy Body's own n).

Storage: the Roy Body stays one `Formulation` row (role `DESIGN_ROY_BODY`) with extra columns `numberOfBodies`, `hasVein`, `veinNotes`, `mixerTypeId`; its vein methods are `FormulationVeinMethod` rows, its readings `FormulationMeasurement` rows, and the nested vein Roy Body is a child `Formulation` (`parentId`, role `VEIN_ROY_BODY`). Everything cascades with the sample / entry. UI: `components/lab/RoyBodyFields.tsx` and the shared `VeinFields.tsx` (the main Vein section uses the same component); server: `writeRoyBody()` in `modules/formulation/service.ts`. Material consumption (Reports, Downloads) includes the nested Roy Body's quantities.

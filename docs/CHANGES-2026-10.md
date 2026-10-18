# Lab ERP — Change Documentation · 17–18 October 2026

What changed, why, how it was built and which files it touched. Written for the
reviewer of the pull request: every item below was checked against the code in
this branch, not against a plan.

* **Part A — 17 October:** requirements 4 to 14 of the change list (committed as `New 10 changes`).
* **Part B — 18 October:** six further changes (this commit).
* **Part C:** database step, how it was verified, and the decisions worth a second opinion.

Nothing in the application's existing behaviour was removed except where a
requirement asked for it; each such removal is called out.

---

## Status at a glance

| # | Requirement | Where it lives | State |
|---|---|---|---|
| A4 | Separate Lab Sample and Inward / Outward databases | `prisma/schema.prisma`, `*/record-store.ts` | Done |
| A5 | Lab Sample form takes design data from Inward / Outward | `modules/samples/inward-link.ts` | Done |
| A6 | Historical colours · date-wise S.No. and Slab Number | `modules/forms/date-numbering.ts` | Done |
| A7 | Forum as its own section; posting and reply rules | `modules/forum`, `/forum` | Done (renamed in B4) |
| A8 | Dashboard: Line Samples = Production Samples | `modules/dashboard` | Done |
| A9 | Lab register Design Type column; full Review | `modules/samples` | Done |
| A10 | Registers, Review and Edit across all three forms; latest 15 | all three modules | Done |
| A11 | Reports: three totals, Design Type Analysis, Additives | `modules/reports` | Done |
| A12 | Downloads: three reports and the new filters | `modules/downloads` | Done |
| A13 | Material lists start empty; values kept per field | `modules/master-data` | Done |
| A14 | Master Data: Design Types; vein lists removed | `modules/master-data/catalog.ts` | Done |
| B1 | S.No. and Slab Number editable in all three forms | `components/forms/DateNumberFields.tsx` | Done |
| B2 | Professional Excel formatting and column structure | `modules/downloads/excel.ts` | Done |
| B3 | Register tables complete on tablets | three register components | Done |
| B4 | Forum renamed Announcement | `modules/registry.ts`, `/announcements` | Done |
| B5 | New section: Slab Records | `modules/slab-records` | Done |
| B6 | Sample Data Download: Search, Clear filters, results table | `modules/downloads` | Done |

---

# Part A — 17 October (requirements 4–14)

## A4 · Separate databases for Lab Sample and Inward / Outward

**Requirement.** Every saved record must also be stored in a separate database
for its form, holding all form fields, while the existing registers stay as they are.

**Implementation.** Two tables hold a complete, self-contained copy of each
saved record: `LabSampleRecord` (keyed by `sampleId`) and `InwardOutwardRecord`
(keyed by `entryId`). Each row carries the fields that are queried — S.No., Slab
Number, date, Design Name, Plain Body, design types, Number of Bodies — as real
columns, plus the whole record as JSON in `data`, and a `formVersion` so an older
copy can be spotted and rewritten. The copy is written inside the same database
transaction as the save, so a record and its copy can never disagree; deleting a
record cascades to its copy. `ensureRecordStores()` brings every copy up to date
on the first page load after an update.

**Files.** `prisma/schema.prisma` · `src/modules/samples/record-store.ts` ·
`src/modules/inward-outward/record-store.ts` · `src/modules/records/sync.ts` ·
`src/modules/samples/include.ts` · `src/modules/inward-outward/include.ts` ·
the two `service.ts` files.

## A5 · Inward / Outward feeds the Lab Sample form

**Requirement.** Treat Inward / Outward as the master record of existing physical
samples. Design Name suggestions, the design-type combinations near the field,
and — on picking one — Design Type, Number of Bodies and the Post Polish L, a, b,
all editable, with Post Press left empty and the inward record untouched.

**Implementation.** `inwardDesignSuggestions()` reads the Inward / Outward
database and groups its records by Design Name and design-type combination
("Statuario – Roy Body + Carrara"), newest first, with the count when a name has
several. A panel under Basic Information lists them with a **Use** button. Use
fills Plain Body, the design types, Number of Bodies, the Roy / Chessboard counts
and the Post Polish readings only; Post Press stays empty. Every filled field
stays editable and the toast offers **Undo**. Nothing is written back to the
inward record, and a Design Name with no match simply shows a note.

**Files.** `src/modules/samples/inward-link.ts` · `src/modules/samples/design-suggestion.ts` ·
`src/modules/samples/actions.ts` · `src/modules/samples/components/LabSampleForm.tsx` ·
`src/app/(app)/samples/page.tsx` · `src/app/(app)/samples/[id]/edit/page.tsx`.

## A6 · Historical colours, and Date / S.No. / Slab Number

**Requirement (part 1).** Kreos, Carrara and Vein colour pickers must offer every
colour ever entered under Pigments.

**Implementation.** Those fields already read the shared Pigments list that the
Material Details pigments write to, so every colour used anywhere is offered.
Confirmed by entering a new pigment colour in a lab sample and finding it in the
Carrara and Kreos pickers of the next entry.

**Requirement (part 2).** In all three forms: today's date by default, a manually
selectable date, S.No. restarting at 1 per date, Slab Number typed for the first
entry of a date and previous + 1 afterwards, safe under concurrent saves and
across edits and deletes.

**Implementation.** One engine, `modules/forms/date-numbering.ts`, is shared by
the three forms over their own records. Numbers are allocated inside the save
transaction under a per-form PostgreSQL advisory lock (lab 4471001, inward
4471002, production 4471003), and `(date, S.No.)` is unique in the database, so
two people saving at the same moment cannot collide. Moving a record to another
date or deleting one renumbers the remaining records of the affected date so it
always reads 1 … k with no gaps; Slab Numbers are never changed by renumbering.
Records saved under the old rule (one running S.No. across all dates) are
renumbered per date on the first start after the update.

**Files.** `src/modules/forms/date-numbering.ts` · `src/components/forms/DateNumberFields.tsx` ·
`src/modules/{samples,inward-outward,production}/numbering.ts` · the three `service.ts`
and `schema.ts` files · `src/modules/records/sync.ts` · `prisma/schema.prisma`.

## A7 · Forum as its own section

**Requirement.** Remove the Forum from the Dashboard and give it its own
navigation entry; prefill "Admin" in Posted by, keep it editable, make the title
optional; always ask for the replier's name and never prefill it.

**Implementation.** A section of its own with its own page; the Dashboard banner
and component were removed. `DEFAULT_POSTER = "Admin"` fills Posted by on a new
post. The title is optional — a post without one is headed by the start of its
message. The reply box always asks for a name, is never prefilled, and refuses to
post without one. Nothing is remembered in the browser. (Renamed to
**Announcement** on 18 October — see B4.)

**Files.** `src/modules/forum/schema.ts` · `src/modules/forum/components/Forum.tsx` ·
`src/modules/forum/components/PostCard.tsx` · `src/modules/forum/components/forum-ui.tsx` ·
`src/modules/registry.ts` · `src/app/(app)/dashboard/page.tsx` · `src/lib/permissions.ts`.

## A8 · Dashboard — Line Samples are Production Samples

**Requirement.** Calculate every Line Samples figure from the Production Sample
form and remove the separate Total Production Samples card.

**Implementation.** Line today = production samples dated today; Total Line
Samples = all production samples; Total Samples = Lab + Line, today and overall.
The separate card is gone and Overall Information now shows four cards. The Line
cards note "Production Samples" and link to the production register.

**Files.** `src/modules/dashboard/queries.ts` · `src/modules/dashboard/components/OverallKpis.tsx` ·
`src/modules/dashboard/components/TodayPanel.tsx`.

## A9 · Lab register and Review

**Requirement.** Rename Design to Design Type, show every selected type, and make
Review mirror the form from top to bottom.

**Implementation.** The column is "Design Type" and lists all selected types
("Roy Body, Carrara"); Plain Body entries read "Plain Body". Review follows the
form's order: Basic Information → Design Type and Number of Bodies → Material
Details per body → each design type's own section → L, a, b (Post Press and Post
Polish for every body, Roy Body and Chessboard Body) → Sample Output → Remarks,
with anything an earlier form recorded in a clearly marked block at the end.

**Files.** `src/modules/samples/components/RecentEntries.tsx` ·
`src/modules/samples/components/SampleDetailView.tsx` · `src/modules/samples/queries.ts`.

## A10 · All three registers, Review and Edit

**Requirement.** Inward: Design Type column, Rectification removed entirely.
Production: L, a, b column removed from the register and shown on Review. All
three: Review complete, Edit able to change everything, registers showing the
latest 15 entries.

**Implementation.** The inward register shows every design type (entries of the
earlier form derive theirs from their design patterns). Rectification is gone:
component deleted, queries and the page section removed. The production register
drops the L, a, b column and its Review page shows every reading. All three
registers page 15 at a time. Edit loads every saved value — nested material
details, several design types, body counts, readings and uploaded files — and
saves them back without losing data.

**Files.** `src/modules/inward-outward/components/InwardRegister.tsx` ·
`src/modules/inward-outward/design-text.ts` · `src/modules/inward-outward/queries.ts` ·
(deleted) `src/modules/inward-outward/components/RectificationList.tsx` ·
`src/modules/production/components/ProductionRegister.tsx` ·
`src/modules/production/components/ProductionDetailView.tsx` ·
`src/modules/samples/components/RecentEntries.tsx` · `src/app/(app)/inward-outward/page.tsx`.

## A11 · Reports

**Requirement.** Replace the three KPI cards with Total Lab Samples, Total
Inward / Outward Samples and Total Production Samples, all following the date
range. Rename Design Analysis to Design Type Analysis, total per type over the
whole period, sorted high to low, counting a record under each of its types. Add
Additives to Material Consumption, immediately right of Pigments.

**Implementation.** The three totals read their own tables for the selected
range (7 / 15 / 30 days). Design Type Analysis aggregates over the period rather
than per day, sorted by count, and a record with several types is counted under
each; design types are read from the two record databases. Additives is a
material category of its own, computed from `FormulationAdditive`, placed right
after Pigments.

**Files.** `src/modules/reports/build.ts` · `src/modules/reports/queries.ts` ·
`src/modules/reports/components/Charts.tsx` · `src/app/(app)/reports/page.tsx` ·
`src/modules/forms/design-types.ts`.

## A12 · Downloads

**Requirement.** Remove the Production Sample Data Download subsection. The
Download dropdown must offer exactly Lab Sample Reports, Sample Inward/Outward
Reports and Production Sample Reports, each exporting its form's complete data.
In Filtered Data Export: the same three Sample Type values, Design renamed Sample
Design (every historical Design Name from all three forms) and Design Pattern
renamed Design Type (the types saved across the forms), with filtering and export
working on the selected type.

**Implementation.** The page now has two subsections. Each report exports every
field of its form plus detail sheets. The filters are Sample Type (the three
reports), Sample Design (a searchable list of every Design Name saved on any of
the three forms, including names typed before the list existed) and Design Type
(Plain Body, the five design types and any design pattern an earlier form
recorded). Names are matched ignoring case and spaces, and a record with several
types matches each of them. Filters live in the URL, so the on-screen list and
the Excel always hold the same records.

**Files.** `src/app/(app)/downloads/page.tsx` · `src/modules/downloads/filters.ts` ·
`src/modules/downloads/data.ts` · `src/modules/downloads/excel.ts` ·
`src/modules/downloads/components/FilterForm.tsx` · `src/app/api/downloads/route.ts` ·
(deleted) `ProductionDownload.tsx`, `labels.ts`.

## A13 · Materials start empty

**Requirement.** Remove the predefined values of Resin, Grits, Grit Sizes,
Filler, Pigments / Color Used and Additives — in the forms and in Master Data.
New typed values are kept for that field only, never mixed between fields, and
colour fields must accept letters, numbers and special characters such as
`#red097!`.

**Implementation.** Those six lists are marked as typed-only and ship empty.
Values seeded by an earlier version are removed once, by `npm run db:seed` and on
the first start of the server: deleted where no record uses them, otherwise
disabled and hidden from the dropdowns and from Master Data while the records
that use them still display them. Typing such a value again makes it an ordinary
value. Each field writes to its own list, so a resin never appears under Grits,
and labels are only trimmed and space-collapsed, so punctuation and digits survive.

**Files.** `src/modules/master-data/catalog.ts` · `src/modules/master-data/retire.ts` ·
`src/modules/master-data/service.ts` · `src/modules/master-data/actions.ts` · `prisma/seed.ts`.

## A14 · Master Data

**Requirement.** Rename Design Pattern to Design Types; remove the Vein Details
and Vein Introduction Methods lists.

**Implementation.** The list is called **Design Types** (names and descriptions
follow the catalog on every start). *Vein Introduction Methods* is retired —
hidden, and deleted by the seed once nothing refers to it — and *Vein Details* is
no longer shown in Master Data. **Note:** the Vein Details field inside the Kreos
and Vein sections of the forms still works and still offers what was typed
before; only its Master Data entry is gone. Say the word if it should disappear
from the forms too.

**Files.** `src/modules/master-data/catalog.ts` · `src/modules/master-data/service.ts` ·
`src/modules/master-data/retire.ts` · `prisma/seed.ts`.

---

# Part B — 18 October

## B1 · S.No. and Slab Number can be typed over

**Requirement.** Both fields keep filling in from the selected date, but a user
must be able to edit or override them before saving, without breaking the
date-wise numbering.

**Implementation.** Both are ordinary inputs now. A typed S.No. puts the record
at that place in its date and moves the entries from there on down one, so the
date still reads 1 … k with no gaps and no duplicates (`placeInDate`); a number
past the last entry becomes that last place and the save message says so. On
edit, both fields open with the record's own values; typing a new S.No. moves the
record within its date. Untouched, a suggestion is re-read at save time, so
simultaneous saves still cannot collide. A Slab Number already used is refused
with the record that holds it. Everyone who may enter records may type numbers
(`*.overrideNumbers` now includes Lab Operator).

**Files.** `src/modules/forms/date-numbering.ts` · `src/components/forms/DateNumberFields.tsx` ·
the three `service.ts` and `actions.ts` files · the three form components · `src/lib/permissions.ts` ·
`tests/date-numbering.test.ts` (new).

## B2 · Professional Excel formatting

**Requirement.** Improve the formatting and column structure of every downloaded
sheet. Production Sample Reports must carry Date, S.No., Slab Number, Design Name
and Number of Bodies under Basic Information, then all L, a, b values under L, a,
b Measurements, then Remarks. Other reports follow the same logic by form
subsection. Remove the Sample Output columns and the Created By / Last Updated By
/ Last Updated At columns.

**Implementation.** One writer formats every sheet: report name and Production
Date on top, the form's sections as a merged heading row, the fields beneath,
then one row per record. Headers are frozen and repeat when printed, each table
has an auto-filter, Date / S.No. / Slab Number stay in view while scrolling
right, dates and numbers carry their formats, rows are striped and boxed, and the
page is landscape fitted to one page wide. Production columns are exactly as
listed. Lab and Inward / Outward follow their own form order. Sample Output and
the metadata columns are gone.

**Decision to confirm:** *Created At* was dropped as well, although it was not
named. The production list ends at Remarks, and leaving a lone timestamp on only
two of the three reports would have undone the consistency this change is for.
It can be restored in one line.

**Files.** `src/modules/downloads/excel.ts` · `src/app/api/downloads/route.ts`.

## B3 · Register tables on tablets

**Requirement.** Every register must show all its columns and values, work on
tablets with horizontal scrolling or another suitable layout, and hide nothing on
smaller screens.

**Implementation.** All three registers show the complete table from tablet width
(640 px) upward, inside a horizontal scroller with a minimum table width so
columns stay readable instead of being squeezed, with a line above saying the
table scrolls sideways. Below that, phones get the same fields as one card per
record. Verified at 820 px and 1180 px: Lab 9 columns, Inward / Outward 10,
Production 8, with no page-level overflow.

**Files.** `src/modules/samples/components/RecentEntries.tsx` ·
`src/modules/inward-outward/components/InwardRegister.tsx` ·
`src/modules/production/components/ProductionRegister.tsx`.

## B4 · Forum renamed Announcement

**Requirement.** Rename the section, keep its functionality unchanged.

**Implementation.** The sidebar, page title, headings and messages say
**Announcement**; the section now lives at `/announcements` and `/forum`
permanently redirects, so saved links keep working. The rename is label-only:
tables (`Announcement`, `ForumReply`), module folder and permission keys
(`forum.*`) are unchanged, so no data moved and no behaviour changed.

**Files.** `src/app/(app)/announcements/page.tsx` (new) · `src/app/(app)/forum/page.tsx` (now a redirect) ·
`src/modules/registry.ts` · `src/components/shell/AppShell.tsx` ·
`src/modules/forum/actions.ts` · `src/modules/forum/components/*`.

## B5 · New section — Slab Records

**Requirement.** A new section between Production Sample and Reports for finding
slabs made before, including ones with similar L, a, b, months later. Two
searches: by L, a, b (±0.5 on each value independently, Post Polish where
available, nearest first, showing Slab Number, Production Date, Design Name,
Design Type and the matching values, with the source form named); and by
Production Date, Slab Number and Design Name in any combination.

**Implementation.** `/slab-records`, both searches holding their state in the URL
so a result can be shared.

*By L, a, b:* one SQL statement unions every saved reading of the three
measurement tables. Per record, part and body it keeps **Post Polish** where the
form has stages and falls back to that body's Post Press, so a sample that was
only pressed is still findable; Inward / Outward has one reading per body. A slab
matches when each of L, a and b is within ±0.5, and rows are ranked by
|ΔL| + |Δa| + |Δb|, the closest badged *Nearest*. One row per matching body, with
the body, the stage, the reading and how far each value is off. Verified against
the database: the boundary includes 0.50 and excludes 0.51, and the row count
matched the same rule run directly in SQL.

*By any parameter:* Production Date (Any date / All / Date Wise / Date Range),
Slab Number (exact) and Design Name (matched ignoring case and spaces, against
the list value or a name typed before the list existed). Any one filter or all of
them; a record must match every filter given. The three forms are queried in
parallel and merged newest first.

**Files (all new).** `src/modules/slab-records/queries.ts` · `src/modules/slab-records/search.ts` ·
`src/modules/slab-records/components/{MeasurementSearchForm,ParameterSearchForm,SlabResults}.tsx` ·
`src/app/(app)/slab-records/page.tsx` · `tests/slab-search.test.ts`.
**Also touched.** `src/modules/registry.ts` · `src/components/shell/AppShell.tsx` ·
`src/lib/permissions.ts` (new `slab.view`).

## B6 · Sample Data Download — Search, Clear filters, results table

**Requirement.** Add Search and Clear Filters matching the Filtered Data Export
subsection; Search must first list the matching records on the page with all
relevant columns, offer an Excel download of exactly those records, and Clear
Filters must reset the filters and the results.

**Implementation.** The subsection is now a search like the other one. Search
lists the records of the chosen report and Production Date in a results table;
*Download Excel* sits beside the header and takes exactly those records; Clear
filters returns the page to its starting state. The results table is shared with
Filtered Data Export, so both read alike — S.No., Date, Slab Number, Sample Type,
Sample Design, Design Type, Number of Bodies and Review, plus **Company Name**
for the Inward / Outward report, which is the form that records it (the same
column was added to the filtered export's Excel summary sheet). Long lists show
the first 200 rows and say so; the Excel always holds every record. The two
searches keep their settings under different URL keys, so neither disturbs the other.

**Files.** `src/modules/downloads/components/ReportSearchForm.tsx` (new) ·
`src/modules/downloads/components/RecordsTable.tsx` (new) ·
`src/app/(app)/downloads/page.tsx` · `src/modules/downloads/filters.ts` ·
`src/modules/downloads/period.ts` · `src/modules/downloads/components/ProductionDateFields.tsx` ·
`src/modules/downloads/components/FilterForm.tsx` ·
(deleted) `SampleDownload.tsx`, `download-file.ts`, `actions.ts`.

---

# Part C — running it, checking it, and open points

## C1 · Database step (required once, before the app is started)

Part A changes the schema; Part B does not. In the project folder:

```
npm run db:push
```

Answer **y** to the warnings about the new unique constraints. Then start the app
normally. On the first start the app, by itself:

* renumbers existing records so S.No. runs 1 … k within each date (Slab Numbers untouched);
* fills the Lab Sample and Inward / Outward databases with a copy of every saved record;
* removes the predefined material values — deleting the unused ones and hiding the rest.

No data is deleted by any of this, and it is safe to run again.

## C2 · How this was checked

* **Automated tests:** 92 across 14 files, including new ones for the numbering
  rules, the Slab Records searches, the download filters and the master lists.
  Run with `npm test`.
* **Type check and lint:** `npm run typecheck`, `npm run lint` — both clean.
* **Build:** `npm run build` — clean.
* **Browser checks against a real database:** every change was driven through the
  running app and the results compared with SQL — the numbering edge cases
  (typed, clamped, moved, deleted, two users saving at once), the downloaded Excel
  files opened and their columns and record counts compared with the page, the
  slab search boundaries, and the registers at tablet sizes.
* **Code check for this document:** 35 assertions run against the files in this
  branch, one per requirement. All pass.

## C3 · Points a reviewer may want to decide

1. **Created At was removed from the Excel reports** (B2) though only three
   metadata columns were named. One line to restore.
2. **Vein Details still appears inside the Kreos and Vein form sections** (A14);
   only the Master Data entry was removed.
3. **"All" in Production Date means up to today**, so a record dated in the
   future is not included — unchanged behaviour, worth knowing when counts are compared.
4. **The Announcement rename is label-only** (B4): tables, modules and permission
   keys still say `forum`, so nothing had to migrate.

---

## Appendix · Pull request text

**Title**

```
Lab ERP: separate record databases, date-wise numbering, Slab Records section, reworked Downloads and Reports
```

**Description** — see `PULL-REQUEST.md` next to this file, or paste the summary
from the project chat.

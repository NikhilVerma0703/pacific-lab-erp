# Pull request — text to paste

Ready to copy into GitHub. The full detail is in `CHANGES-2026-10.md` beside this file.

---

## Title

```
Lab ERP: separate record databases, date-wise numbering, Slab Records section, reworked Downloads and Reports
```

---

## Description

```markdown
Two days of agreed changes to the Laboratory ERP: requirements 4–14 of the
change list (17 Oct) and six further changes (18 Oct). Full detail, file by
file, in `docs/CHANGES-2026-10.md`.

### What this adds

**Records and numbering**
- Lab Sample and Sample Inward / Outward each get their own database table
  holding a complete copy of every saved record, written in the same
  transaction as the save. The existing registers are unchanged.
- The Lab Sample form suggests Design Names from saved Inward / Outward
  records and can fill Design Type, Number of Bodies and the Post Polish
  L, a, b from one of them. Everything stays editable; the inward record is
  never touched.
- Date, S.No. and Slab Number now work per date in all three forms: today by
  default, S.No. restarting at 1 for each date, Slab Number typed for the
  first entry and previous + 1 afterwards. Numbers are allocated inside the
  save transaction under a per-form lock, so simultaneous saves cannot
  collide, and deleting or moving a record renumbers that date.
- Both numbers can also be typed over before saving. A typed S.No. places the
  record at that position and shifts the rest, so a date always reads 1 … k.

**New section**
- **Slab Records** (between Production Sample and Reports): find a slab made
  before, by L, a, b (±0.5 on each value, Post Polish where available, nearest
  first) or by Production Date, Slab Number and Design Name in any
  combination. Searches all three forms.

**Downloads**
- Two subsections. Each has Search and Clear filters, lists the matching
  records on the page, and downloads exactly those records.
- Three reports: Lab Sample, Sample Inward/Outward, Production Sample — each
  exporting the complete data of its form.
- Filters: Sample Type, Sample Design (every Design Name saved across the
  three forms) and Design Type.
- Every sheet reformatted: report name and period on top, the form's sections
  as a heading band, frozen and repeating headers, auto-filter, date and
  number formats, landscape fitted to one page wide. Sample Output and the
  record-metadata columns are no longer exported.

**Reports, Dashboard, registers, Master Data**
- Reports: Total Lab / Inward-Outward / Production Samples by date range;
  Design Analysis is now Design Type Analysis, totalled over the period and
  sorted; Additives added to Material Consumption.
- Dashboard: Line Samples are Production Samples; the duplicate Total
  Production Samples card is gone.
- All three registers: Design Type columns, Rectification removed, the
  production L, a, b column moved to Review, latest 15 entries, and the full
  table on tablets with horizontal scrolling.
- Master Data: material lists (Resin, Grits, Grit Sizes, Filler, Pigments,
  Additives) start empty and keep what people type, per field, including
  values like `#red097!`; Design Patterns renamed Design Types; the two vein
  lists removed.
- Forum renamed **Announcement** (label only — tables, modules and permission
  keys unchanged); `/forum` redirects to `/announcements`.

### Database

`npm run db:push` once before starting the app, answering **y** to the new
unique constraints. On first start the app renumbers S.No. per date, fills the
two record tables and clears the predefined material values (deleting unused
ones, hiding those still in use). Nothing is deleted; it is safe to re-run.

### Checks

- 92 automated tests across 14 files (`npm test`), including new tests for the
  numbering rules, the Slab Records searches and the download filters.
- `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
- Each change driven through the running app against a real database, with the
  downloaded Excel files opened and compared with the on-screen records.

### Worth a decision from the reviewer

1. `Created At` was also dropped from the Excel reports, though only three
   metadata columns were named — one line to restore.
2. The Vein Details field still exists inside the Kreos and Vein form
   sections; only its Master Data entry was removed.
3. "All" in Production Date means up to today, so future-dated records are not
   counted. Existing behaviour, but relevant when comparing totals.

Please review — not merging this myself.
```

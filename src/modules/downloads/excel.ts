import "server-only";
import ExcelJS from "exceljs";
import type { ComponentDTO, FormulationDTO, SampleDetail } from "@/modules/samples/queries";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { CompleteRow } from "./data";
import { componentText, MATERIAL_KIND_LABEL, type ExportFilters, type FilteredRow } from "./filters";

// ── generic sheet writer ─────────────────────────────────────────────────────

type Cell = string | number | Date | null | undefined;

export interface Col<T> {
  header: string;
  /** Group heading shown above the column (merged across the group). */
  group?: string;
  width?: number;
  kind?: "date" | "datetime" | "number" | "text";
  value: (row: T) => Cell;
}

const BRAND = "FF1F3A5F";
const GROUP_FILL = "FFE6EEF7";

function addSheet<T>(wb: ExcelJS.Workbook, name: string, cols: Col<T>[], rows: T[], opts: { emptyNote?: string } = {}) {
  const ws = wb.addWorksheet(name);
  const grouped = cols.some((c) => c.group);
  ws.columns = cols.map((c) => ({ width: c.width ?? Math.min(40, Math.max(12, c.header.length + 4)) }));

  if (grouped) {
    const g = ws.addRow(cols.map((c) => c.group ?? ""));
    let start = 0;
    for (let i = 1; i <= cols.length; i++) {
      if (i === cols.length || cols[i].group !== cols[start].group) {
        if (i - start > 1 && cols[start].group) ws.mergeCells(1, start + 1, 1, i);
        start = i;
      }
    }
    g.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: BRAND } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  const h = ws.addRow(cols.map((c) => c.header));
  h.height = 30;
  h.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  const headerRows = grouped ? 2 : 1;
  ws.views = [{ state: "frozen", ySplit: headerRows, xSplit: 1 }];

  for (const r of rows) {
    const row = ws.addRow(cols.map((c) => {
      const v = c.value(r);
      return v === undefined || v === "" ? null : v;
    }));
    row.alignment = { vertical: "top", wrapText: true };
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.kind === "date") cell.numFmt = "dd-mmm-yyyy";
      if (c.kind === "datetime") cell.numFmt = "dd-mmm-yyyy hh:mm";
    });
  }
  if (rows.length) {
    ws.autoFilter = { from: { row: headerRows, column: 1 }, to: { row: headerRows, column: cols.length } };
  } else {
    ws.addRow([opts.emptyNote ?? "No records for the selected date."]).font = { italic: true, color: { argb: "FF7A8896" } };
  }
  return ws;
}

// ── value helpers ────────────────────────────────────────────────────────────

const num = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
const dateOnly = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);
/** Excel has no time zones — write the plant's wall-clock time. */
const plantDateTime = (iso: string | null | undefined) => {
  if (!iso) return null;
  const tz = process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
};
const yesNo = (b: boolean | null) => (b === null ? null : b ? "Yes" : "No");
const designLabel = (d: "PLAIN_BODY" | "NON_PLAIN_BODY" | null) => (d === "PLAIN_BODY" ? "Plain Body" : d === "NON_PLAIN_BODY" ? "Non-Plain Body" : null);
const labels = (xs: { label: string }[]) => xs.map((x) => x.label).join(", ") || null;
const FORMULATION_NAME: Record<FormulationDTO["role"], string> = {
  MAIN_BODY: "Main Body",
  DESIGN_ROY_BODY: "Roy Body — Design",
  VEIN_ROY_BODY: "Roy Body — Vein",
};
const KIND_COLS: { kind: ComponentDTO["kind"]; label: string }[] = [
  { kind: "RESIN", label: "Resin" },
  { kind: "GRIT", label: "Grits" },
  { kind: "FILLER", label: "Filler" },
  { kind: "PIGMENT", label: "Pigments" },
];

function formulationCols<T>(group: string, get: (r: T) => Pick<FormulationDTO, "components"> | undefined | null): Col<T>[] {
  return KIND_COLS.map(({ kind, label }) => ({
    group,
    header: label,
    width: 30,
    value: (r: T) =>
      get(r)
        ?.components.filter((c) => c.kind === kind)
        .map(componentText)
        .join("; ") || null,
  }));
}

/** The Roy Body's own n, vein (with mixer) and the formulation of its vein Roy Body. */
function royDetailCols<T>(group: string, get: (r: T) => FormulationDTO | undefined | null): Col<T>[] {
  return [
    { group, header: "Roy Body — Number of Bodies", width: 12, kind: "number", value: (r) => get(r)?.numberOfBodies },
    { group, header: "Roy Body — Vein", width: 10, value: (r) => yesNo(get(r)?.hasVein ?? null) },
    { group, header: "Roy Body — Mixer Type", width: 14, value: (r) => get(r)?.mixerType?.label },
    { group, header: "Roy Body — How Vein Introduced", width: 24, value: (r) => (get(r) ? labels(get(r)!.veinMethods) : null) },
    { group, header: "Roy Body — Vein Details", width: 24, value: (r) => get(r)?.veinNotes },
    ...formulationCols<T>(`${group} · Vein Roy Body`, (r) => get(r)?.veinRoyBody).map((c) => ({ ...c, header: `Vein Roy Body — ${c.header}` })),
  ];
}

function labCols<T>(group: string, n: number, get: (r: T, body: number) => { l: string | null; a: string | null; b: string | null } | undefined): Col<T>[] {
  const cols: Col<T>[] = [];
  for (let i = 1; i <= n; i++) {
    for (const k of ["l", "a", "b"] as const) {
      cols.push({ group, header: `Body ${i} ${k === "l" ? "L" : k}`, width: 10, kind: "number", value: (r) => num(get(r, i)?.[k]) });
    }
  }
  return cols;
}

// ── column sets ──────────────────────────────────────────────────────────────

function sampleCols<T>(get: (r: T) => SampleDetail | null, prefix = ""): Col<T>[] {
  const g = (name: string) => `${prefix}${name}`;
  const f = (r: T, role: FormulationDTO["role"]) => get(r)?.formulations.find((x) => x.role === role);
  return [
    { group: g("Basic Information"), header: "S.No.", width: 8, kind: "number", value: (r) => get(r)?.serialNo },
    { group: g("Basic Information"), header: "Slab Number", width: 12, kind: "number", value: (r) => get(r)?.slabNumber },
    { group: g("Basic Information"), header: "Date", width: 13, kind: "date", value: (r) => dateOnly(get(r)?.sampleDate) },
    { group: g("Basic Information"), header: "Status", width: 10, value: (r) => (get(r) ? (get(r)!.status === "DRAFT" ? "Draft" : "Saved") : null) },
    { group: g("Basic Information"), header: "Sample Type", width: 16, value: (r) => get(r)?.sampleType?.label },
    { group: g("Basic Information"), header: "Design Name", width: 22, value: (r) => get(r)?.designName },
    { group: g("Basic Information"), header: "Physical Sample Present", width: 12, value: (r) => yesNo(get(r)?.physicalSamplePresent ?? null) },
    { group: g("Basic Information"), header: "Number of Bodies", width: 10, kind: "number", value: (r) => get(r)?.numberOfBodies },
    ...formulationCols<T>(g("Material Choices — Main Body"), (r) => f(r, "MAIN_BODY")),
    { group: g("Design"), header: "Design", width: 15, value: (r) => designLabel(get(r)?.designCategory ?? null) },
    { group: g("Design"), header: "Design Pattern(s)", width: 28, value: (r) => (get(r) ? labels(get(r)!.designPatterns) : null) },
    ...formulationCols<T>(g("Roy Body Formulation — Design"), (r) => f(r, "DESIGN_ROY_BODY")),
    ...royDetailCols<T>(g("Roy Body Formulation — Design"), (r) => f(r, "DESIGN_ROY_BODY")),
    { group: g("Mixer & Vein"), header: "Mixer Type", width: 12, value: (r) => get(r)?.mixerType?.label },
    { group: g("Mixer & Vein"), header: "Vein", width: 8, value: (r) => yesNo(get(r)?.hasVein ?? null) },
    { group: g("Mixer & Vein"), header: "How Vein Introduced", width: 24, value: (r) => (get(r) ? labels(get(r)!.veinMethods) : null) },
    { group: g("Mixer & Vein"), header: "Vein Details", width: 28, value: (r) => get(r)?.veinNotes },
    ...formulationCols<T>(g("Roy Body Formulation — Vein"), (r) => f(r, "VEIN_ROY_BODY")),
  ];
}

function sampleLabAndRecordCols<T>(get: (r: T) => SampleDetail | null, maxBodies: number, prefix = ""): Col<T>[] {
  const m = (r: T, stage: "POST_PRESS" | "POST_POLISH", i: number) =>
    get(r)?.measurements.find((x) => x.stage === stage && x.bodyIndex === i);
  return [
    ...labCols<T>(`${prefix}L, a, b — Post Press`, maxBodies, (r, i) => m(r, "POST_PRESS", i)),
    ...labCols<T>(`${prefix}L, a, b — Post Polish`, maxBodies, (r, i) => m(r, "POST_POLISH", i)),
    { group: `${prefix}Output & Record`, header: "Remarks", width: 30, value: (r) => get(r)?.remarks },
    { group: `${prefix}Output & Record`, header: "Output Files", width: 28, value: (r) => get(r)?.attachments.map((a) => a.originalName).join(", ") },
    { group: `${prefix}Output & Record`, header: "Created By", width: 16, value: (r) => get(r)?.createdBy },
    { group: `${prefix}Output & Record`, header: "Created At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.createdAt) },
    { group: `${prefix}Output & Record`, header: "Last Updated By", width: 16, value: (r) => get(r)?.updatedBy },
    { group: `${prefix}Output & Record`, header: "Last Updated At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.updatedAt) },
  ];
}

function inwardCols<T>(get: (r: T) => InwardDetail | null, maxBodies: number, prefix = ""): Col<T>[] {
  const g = (name: string) => `${prefix}${name}`;
  return [
    { group: g("Sample Details"), header: "Date", width: 13, kind: "date", value: (r) => dateOnly(get(r)?.entryDate) },
    { group: g("Sample Details"), header: "Serial Number", width: 10, kind: "number", value: (r) => get(r)?.serialNo },
    { group: g("Sample Details"), header: "Recorded On", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.createdAt) },
    { group: g("Sample Details"), header: "Company Name", width: 22, value: (r) => get(r)?.company?.label },
    { group: g("Sample Details"), header: "Sample Design Name", width: 24, value: (r) => get(r)?.sampleDesignName },
    { group: g("Sample Details"), header: "Number of Bodies", width: 10, kind: "number", value: (r) => get(r)?.numberOfBodies },
    { group: g("Sample Details"), header: "Linked Lab S.No.", width: 10, kind: "number", value: (r) => get(r)?.labSample?.serialNo },
    ...labCols<T>(g("L, a, b"), maxBodies, (r, i) => get(r)?.measurements.find((x) => x.bodyIndex === i)),
    { group: g("Design Pattern"), header: "Design", width: 15, value: (r) => designLabel(get(r)?.designCategory ?? null) },
    { group: g("Design Pattern"), header: "Design Pattern(s)", width: 28, value: (r) => (get(r) ? labels(get(r)!.designPatterns) : null) },
    ...formulationCols<T>(g("Roy Body Formulation"), (r) => get(r)?.royBody),
    ...royDetailCols<T>(g("Roy Body Formulation"), (r) => get(r)?.royBody),
    { group: g("Lab Recreation"), header: "Lab Recreation Attempts", width: 40, value: (r) => get(r)?.recreationAttempts },
    { group: g("Lab Recreation"), header: "Created By", width: 16, value: (r) => get(r)?.createdBy },
    { group: g("Lab Recreation"), header: "Last Updated At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.updatedAt) },
  ];
}

// ── detail sheets (one row per component / per reading) ─────────────────────

interface FormulationLine {
  source: string;
  ref: string;
  formulation: string;
  c: ComponentDTO;
}

function formulationSheet(wb: ExcelJS.Workbook, lines: FormulationLine[]) {
  addSheet<FormulationLine>(
    wb,
    "Formulation Detail",
    [
      { header: "Source", width: 16, value: (l) => l.source },
      { header: "Record", width: 14, value: (l) => l.ref },
      { header: "Formulation", width: 20, value: (l) => l.formulation },
      { header: "Component", width: 12, value: (l) => KIND_COLS.find((k) => k.kind === l.c.kind)?.label },
      { header: "Material", width: 22, value: (l) => l.c.material?.label },
      { header: "Size of Grits", width: 14, value: (l) => l.c.size?.label },
      { header: "Quantity (gm)", width: 14, kind: "number", value: (l) => (l.c.unit === "PERCENT" ? null : num(l.c.quantity)) },
      // Only for values saved before the % option was removed.
      { header: "Note", width: 16, value: (l) => (l.c.unit === "PERCENT" && l.c.quantity !== null ? `recorded as ${Number(l.c.quantity)} %` : null) },
    ],
    lines,
    { emptyNote: "No formulations recorded." },
  );
}

interface LabLine {
  source: string;
  ref: string;
  stage: string;
  body: number;
  l: string | null;
  a: string | null;
  b: string | null;
}

function labSheet(wb: ExcelJS.Workbook, lines: LabLine[]) {
  addSheet<LabLine>(
    wb,
    "L a b",
    [
      { header: "Source", width: 16, value: (l) => l.source },
      { header: "Record", width: 14, value: (l) => l.ref },
      { header: "Stage", width: 30, value: (l) => l.stage },
      { header: "Body", width: 8, kind: "number", value: (l) => l.body },
      { header: "L", width: 10, kind: "number", value: (l) => num(l.l) },
      { header: "a", width: 10, kind: "number", value: (l) => num(l.a) },
      { header: "b", width: 10, kind: "number", value: (l) => num(l.b) },
    ],
    lines,
    { emptyNote: "No L, a, b readings recorded." },
  );
}

const sampleRef = (s: SampleDetail) => `S.No. ${s.serialNo}${s.slabNumber ? ` / Slab ${s.slabNumber}` : ""}`;
const inwardRef = (e: InwardDetail) => `Serial ${e.serialNo}`;

/** Roy Body extras for the detail sheets: its vein Roy Body components and its L/a/b. */
function royLines(fm: FormulationDTO, source: string, ref: string, f: FormulationLine[], l: LabLine[]) {
  for (const c of fm.veinRoyBody?.components ?? []) f.push({ source, ref, formulation: `${FORMULATION_NAME[fm.role]} › Vein Roy Body`, c });
  for (const m of fm.measurements)
    l.push({ source, ref, stage: `${FORMULATION_NAME[fm.role]} · ${m.stage === "POST_PRESS" ? "Post Press" : "Post Polish"}`, body: m.bodyIndex, l: m.l, a: m.a, b: m.b });
}

function sampleLines(samples: SampleDetail[]) {
  const f: FormulationLine[] = [];
  const l: LabLine[] = [];
  for (const s of samples) {
    for (const fm of s.formulations) {
      for (const c of fm.components) f.push({ source: "Data Entry", ref: sampleRef(s), formulation: FORMULATION_NAME[fm.role], c });
      royLines(fm, "Data Entry", sampleRef(s), f, l);
    }
    for (const m of s.measurements)
      l.push({ source: "Data Entry", ref: sampleRef(s), stage: m.stage === "POST_PRESS" ? "Post Press" : "Post Polish", body: m.bodyIndex, l: m.l, a: m.a, b: m.b });
  }
  return { f, l };
}

function inwardLines(entries: InwardDetail[]) {
  const f: FormulationLine[] = [];
  const l: LabLine[] = [];
  for (const e of entries) {
    for (const c of e.royBody?.components ?? []) f.push({ source: "Inward / Outward", ref: inwardRef(e), formulation: "Roy Body — Design", c });
    if (e.royBody) royLines(e.royBody, "Inward / Outward", inwardRef(e), f, l);
    for (const m of e.measurements) l.push({ source: "Inward / Outward", ref: inwardRef(e), stage: "—", body: m.bodyIndex, l: m.l, a: m.a, b: m.b });
  }
  return { f, l };
}

const maxBodies = (xs: { numberOfBodies: number | null }[]) => Math.max(1, ...xs.map((x) => x.numberOfBodies ?? 0));

async function finish(wb: ExcelJS.Workbook): Promise<Buffer> {
  wb.creator = "Pacific Surfaces Lab ERP";
  wb.created = new Date();
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── public builders ──────────────────────────────────────────────────────────

export async function dataEntryWorkbook(samples: SampleDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const id = (s: SampleDetail) => s;
  addSheet<SampleDetail>(wb, "Data Entry Samples", [...sampleCols<SampleDetail>(id), ...sampleLabAndRecordCols<SampleDetail>(id, maxBodies(samples)), { group: "Output & Record", header: "Inward / Outward Serial", width: 10, kind: "number", value: (s) => s.inwardEntry?.serialNo }], samples);
  const { f, l } = sampleLines(samples);
  formulationSheet(wb, f);
  labSheet(wb, l);
  return finish(wb);
}

export async function inwardWorkbook(entries: InwardDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addSheet<InwardDetail>(wb, "Inward Outward Samples", inwardCols<InwardDetail>((e) => e, maxBodies(entries)), entries);
  const { f, l } = inwardLines(entries);
  formulationSheet(wb, f);
  labSheet(wb, l);
  return finish(wb);
}

export async function completeWorkbook(rows: CompleteRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const samples = rows.map((r) => r.sample).filter((s): s is SampleDetail => !!s);
  const entries = rows.map((r) => r.inward).filter((e): e is InwardDetail => !!e);
  addSheet<CompleteRow>(
    wb,
    "Complete Sample Report",
    [
      { group: "Record", header: "Record Type", width: 18, value: (r) => (r.sample && r.inward ? "Lab sample + Inward" : r.sample ? "Lab sample" : "Inward / Outward only") },
      ...sampleCols<CompleteRow>((r) => r.sample, "Data Entry · "),
      ...sampleLabAndRecordCols<CompleteRow>((r) => r.sample, maxBodies(samples), "Data Entry · "),
      ...inwardCols<CompleteRow>((r) => r.inward, maxBodies(entries), "Inward / Outward · "),
    ],
    rows,
  );
  const a = sampleLines(samples);
  const b = inwardLines(entries);
  formulationSheet(wb, [...a.f, ...b.f]);
  labSheet(wb, [...a.l, ...b.l]);
  return finish(wb);
}

export async function filteredWorkbook(rows: FilteredRow[], filters: ExportFilters, labelsFor: Record<string, string>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const mk = filters.materialKind;
  const matName = mk ? (filters.material ? (labelsFor.material ?? "Selected material") : `All ${MATERIAL_KIND_LABEL[mk]}`) : "";
  const cols: Col<FilteredRow>[] = [
    { header: "S.No.", width: 8, kind: "number", value: (r) => r.sample.serialNo },
    { header: "Slab Number", width: 12, kind: "number", value: (r) => r.sample.slabNumber },
    { header: "Date", width: 13, kind: "date", value: (r) => dateOnly(r.sample.sampleDate) },
    { header: "Status", width: 10, value: (r) => (r.sample.status === "DRAFT" ? "Draft" : "Saved") },
    { header: "Sample Type", width: 16, value: (r) => r.sample.sampleType?.label },
    { header: "Design", width: 15, value: (r) => designLabel(r.design.designCategory) },
    { header: "Design Pattern(s)", width: 28, value: (r) => labels(r.design.patterns) },
    { header: "Design Source", width: 16, value: (r) => (r.design.source === "inward" ? "Inward / Outward" : r.design.source === "sample" ? "Data Entry" : null) },
    { header: "Mixer Type", width: 12, value: (r) => r.sample.mixerType?.label },
    { header: "How Vein Introduced", width: 24, value: (r) => labels(r.sample.veinMethods) },
  ];
  if (mk) {
    cols.push(
      { header: `${matName} — Consumed (gm)`, width: 18, kind: "number", value: (r) => r.consumption?.grams ?? 0 },
      { header: `${MATERIAL_KIND_LABEL[mk]} Detail`, width: 36, value: (r) => r.consumption?.detail },
    );
  }
  const ws = addSheet<FilteredRow>(wb, "Filtered Samples", cols, rows, { emptyNote: "No samples match the selected date and filters." });
  if (mk && rows.length) {
    const total = rows.reduce((a, r) => a + (r.consumption?.grams ?? 0), 0);
    const t = ws.addRow([]);
    t.getCell(1).value = "Total";
    t.getCell(cols.length - 1).value = Math.round(total * 1000) / 1000; // the "Consumed (gm)" column
    t.font = { bold: true };
  }

  // Full Data Entry columns for exactly the same records.
  const samples = rows.map((r) => r.sample);
  addSheet<SampleDetail>(wb, "Sample Details", [...sampleCols<SampleDetail>((s) => s), ...sampleLabAndRecordCols<SampleDetail>((s) => s, maxBodies(samples))], samples, {
    emptyNote: "No samples match the selected date and filters.",
  });

  const fs = wb.addWorksheet("Filters Applied");
  fs.columns = [{ width: 24 }, { width: 40 }];
  const head = fs.addRow(["Filter", "Value"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  for (const [k, v] of [
    ["Date", filters.date],
    ["Sample Type", labelsFor.sampleType ?? "Any"],
    ["Design", labelsFor.design ?? "Any"],
    ["Design Pattern", labelsFor.pattern ?? "Any"],
    ["Material Consumption", mk ? matName : "Any"],
    ["Matching samples", String(rows.length)],
  ])
    fs.addRow([k, v]);
  return finish(wb);
}

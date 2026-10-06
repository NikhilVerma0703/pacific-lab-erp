import "server-only";
import ExcelJS from "exceljs";
import type { ComponentDTO, FormulationDTO, SampleDetail } from "@/modules/samples/queries";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { ProductionDetail, ReadingDTO } from "@/modules/production/queries";
import type { CompleteRow } from "./data";
import { componentText, wantsLab, wantsProduction, type ExportFilters, type FilteredRow } from "./filters";
import { periodLabel } from "./period";
import { unionLabels } from "@/modules/samples/bodies";

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
    ws.addRow([opts.emptyNote ?? "No records for the selected Production Date."]).font = { italic: true, color: { argb: "FF7A8896" } };
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

// ── column sets ──────────────────────────────────────────────────────────────

type Lab = { l: string | null; a: string | null; b: string | null } | null | undefined;

/** L, a, b of one body: one reading, or Post Press + Post Polish. */
function bodyLabCols<T>(group: string, stages: { title?: string; get: (r: T) => Lab }[]): Col<T>[] {
  return stages.flatMap(({ title, get }) =>
    (["l", "a", "b"] as const).map((k) => ({
      group,
      header: `${title ? `${title} ` : ""}${k === "l" ? "L" : k}`,
      width: 10,
      kind: "number" as const,
      value: (r: T) => num(get(r)?.[k]),
    })),
  );
}

const bodyCount = (xs: { bodies: unknown[] }[]) => Math.max(1, ...xs.map((x) => x.bodies.length));

/** Basic Information and, for every body, Material Choices · Design (+ Roy Body) · Vein (+ Roy Body) · L, a, b. */
function sampleCols<T>(get: (r: T) => SampleDetail | null, nBodies: number, prefix = ""): Col<T>[] {
  const g = (name: string) => `${prefix}${name}`;
  const cols: Col<T>[] = [
    { group: g("Basic Information"), header: "S.No.", width: 8, kind: "number", value: (r) => get(r)?.serialNo },
    { group: g("Basic Information"), header: "Slab Number", width: 12, kind: "number", value: (r) => get(r)?.slabNumber },
    { group: g("Basic Information"), header: "Date", width: 13, kind: "date", value: (r) => dateOnly(get(r)?.sampleDate) },
    { group: g("Basic Information"), header: "Status", width: 10, value: (r) => (get(r) ? (get(r)!.status === "DRAFT" ? "Draft" : "Saved") : null) },
    { group: g("Basic Information"), header: "Design Name", width: 22, value: (r) => get(r)?.designName },
    { group: g("Basic Information"), header: "Physical Sample Available", width: 12, value: (r) => yesNo(get(r)?.physicalSamplePresent ?? null) },
    { group: g("Basic Information"), header: "Number of Bodies", width: 10, kind: "number", value: (r) => get(r)?.numberOfBodies },
  ];
  for (let i = 1; i <= nBodies; i++) {
    const b = (r: T) => get(r)?.bodies[i - 1];
    const B = (name: string) => g(`Body ${i} · ${name}`);
    cols.push(
      ...formulationCols<T>(B("Material Choices & Pigments"), (r) => b(r)?.main),
      { group: B("Design"), header: "Design", width: 15, value: (r) => designLabel(b(r)?.designCategory ?? null) },
      { group: B("Design"), header: "Design Pattern(s)", width: 28, value: (r) => (b(r) ? labels(b(r)!.designPatterns) : null) },
      ...formulationCols<T>(B("Roy Body Formulation — Design"), (r) => b(r)?.designRoyBody),
      ...royDetailCols<T>(B("Roy Body Formulation — Design"), (r) => b(r)?.designRoyBody),
      { group: B("Vein"), header: "Mixer Type", width: 12, value: (r) => b(r)?.mixerType?.label },
      { group: B("Vein"), header: "Vein", width: 8, value: (r) => yesNo(b(r)?.hasVein ?? null) },
      { group: B("Vein"), header: "How Vein Introduced", width: 24, value: (r) => (b(r) ? labels(b(r)!.veinMethods) : null) },
      { group: B("Vein"), header: "Vein Details", width: 28, value: (r) => b(r)?.veinNotes },
      ...formulationCols<T>(B("Roy Body Formulation — Vein"), (r) => b(r)?.veinRoyBody),
      ...bodyLabCols<T>(B("L, a, b"), [
        { title: "Post Press", get: (r) => b(r)?.postPress },
        { title: "Post Polish", get: (r) => b(r)?.postPolish },
      ]),
    );
  }
  return cols;
}

function sampleRecordCols<T>(get: (r: T) => SampleDetail | null, prefix = ""): Col<T>[] {
  return [
    { group: `${prefix}Output & Record`, header: "Remarks", width: 30, value: (r) => get(r)?.remarks },
    { group: `${prefix}Output & Record`, header: "Output Files", width: 28, value: (r) => get(r)?.attachments.map((a) => a.originalName).join(", ") },
    { group: `${prefix}Output & Record`, header: "Created By", width: 16, value: (r) => get(r)?.createdBy },
    { group: `${prefix}Output & Record`, header: "Created At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.createdAt) },
    { group: `${prefix}Output & Record`, header: "Last Updated By", width: 16, value: (r) => get(r)?.updatedBy },
    { group: `${prefix}Output & Record`, header: "Last Updated At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.updatedAt) },
  ];
}

/** Sample Details and, for every body, Design Pattern (+ Roy Body) · L, a, b; then Lab Recreation. */
function inwardCols<T>(get: (r: T) => InwardDetail | null, nBodies: number, prefix = ""): Col<T>[] {
  const g = (name: string) => `${prefix}${name}`;
  const cols: Col<T>[] = [
    { group: g("Sample Details"), header: "Date", width: 13, kind: "date", value: (r) => dateOnly(get(r)?.entryDate) },
    { group: g("Sample Details"), header: "Serial Number", width: 10, kind: "number", value: (r) => get(r)?.serialNo },
    { group: g("Sample Details"), header: "Recorded On", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.createdAt) },
    { group: g("Sample Details"), header: "Company Name", width: 22, value: (r) => get(r)?.company?.label },
    { group: g("Sample Details"), header: "Sample Design Name", width: 24, value: (r) => get(r)?.sampleDesignName },
    { group: g("Sample Details"), header: "Number of Bodies", width: 10, kind: "number", value: (r) => get(r)?.numberOfBodies },
    { group: g("Sample Details"), header: "Linked Lab S.No.", width: 10, kind: "number", value: (r) => get(r)?.labSample?.serialNo },
  ];
  for (let i = 1; i <= nBodies; i++) {
    const b = (r: T) => get(r)?.bodies[i - 1];
    const B = (name: string) => g(`Body ${i} · ${name}`);
    cols.push(
      { group: B("Design Pattern"), header: "Design", width: 15, value: (r) => designLabel(b(r)?.designCategory ?? null) },
      { group: B("Design Pattern"), header: "Design Pattern(s)", width: 28, value: (r) => (b(r) ? labels(b(r)!.designPatterns) : null) },
      ...formulationCols<T>(B("Roy Body Formulation"), (r) => b(r)?.royBody),
      ...royDetailCols<T>(B("Roy Body Formulation"), (r) => b(r)?.royBody),
      ...bodyLabCols<T>(B("L, a, b"), [{ get: (r) => b(r)?.lab }]),
    );
  }
  cols.push(
    { group: g("Lab Recreation"), header: "Lab Recreation Attempts", width: 40, value: (r) => get(r)?.recreationAttempts },
    { group: g("Lab Recreation"), header: "Created By", width: 16, value: (r) => get(r)?.createdBy },
    { group: g("Lab Recreation"), header: "Last Updated At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r)?.updatedAt) },
  );
  return cols;
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
      { header: "Formulation", width: 30, value: (l) => l.formulation },
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
      { header: "Stage", width: 40, value: (l) => l.stage },
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
const stageName = (st: "POST_PRESS" | "POST_POLISH") => (st === "POST_PRESS" ? "Post Press" : "Post Polish");

/** A Roy Body's components, its vein Roy Body's components and its own L/a/b. */
function royLines(fm: FormulationDTO, name: string, source: string, ref: string, f: FormulationLine[], l: LabLine[]) {
  for (const c of fm.components) f.push({ source, ref, formulation: name, c });
  for (const c of fm.veinRoyBody?.components ?? []) f.push({ source, ref, formulation: `${name} › Vein Roy Body`, c });
  for (const m of fm.measurements) l.push({ source, ref, stage: `${name} · ${stageName(m.stage)}`, body: m.bodyIndex, l: m.l, a: m.a, b: m.b });
}

function sampleLines(samples: SampleDetail[]) {
  const f: FormulationLine[] = [];
  const l: LabLine[] = [];
  for (const s of samples) {
    const ref = sampleRef(s);
    for (const b of s.bodies) {
      const B = `Body ${b.index}`;
      for (const c of b.main?.components ?? []) f.push({ source: "Data Entry", ref, formulation: `${B} · Main Body`, c });
      if (b.designRoyBody) royLines(b.designRoyBody, `${B} · Roy Body — Design`, "Data Entry", ref, f, l);
      for (const c of b.veinRoyBody?.components ?? []) f.push({ source: "Data Entry", ref, formulation: `${B} · Roy Body — Vein`, c });
      if (b.postPress) l.push({ source: "Data Entry", ref, stage: "Post Press", body: b.index, ...b.postPress });
      if (b.postPolish) l.push({ source: "Data Entry", ref, stage: "Post Polish", body: b.index, ...b.postPolish });
    }
  }
  return { f, l };
}

function inwardLines(entries: InwardDetail[]) {
  const f: FormulationLine[] = [];
  const l: LabLine[] = [];
  for (const e of entries) {
    const ref = inwardRef(e);
    for (const b of e.bodies) {
      if (b.royBody) royLines(b.royBody, `Body ${b.index} · Roy Body — Design`, "Inward / Outward", ref, f, l);
      if (b.lab) l.push({ source: "Inward / Outward", ref, stage: "—", body: b.index, ...b.lab });
    }
  }
  return { f, l };
}

async function finish(wb: ExcelJS.Workbook): Promise<Buffer> {
  wb.creator = "Pacific Surfaces Lab ERP";
  wb.created = new Date();
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── public builders ──────────────────────────────────────────────────────────

export async function dataEntryWorkbook(samples: SampleDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const id = (s: SampleDetail) => s;
  addSheet<SampleDetail>(
    wb,
    "Data Entry Samples",
    [
      ...sampleCols<SampleDetail>(id, bodyCount(samples)),
      ...sampleRecordCols<SampleDetail>(id),
      { group: "Output & Record", header: "Inward / Outward Serial", width: 10, kind: "number", value: (s) => s.inwardEntry?.serialNo },
    ],
    samples,
  );
  const { f, l } = sampleLines(samples);
  formulationSheet(wb, f);
  labSheet(wb, l);
  return finish(wb);
}

export async function inwardWorkbook(entries: InwardDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addSheet<InwardDetail>(wb, "Inward Outward Samples", inwardCols<InwardDetail>((e) => e, bodyCount(entries)), entries);
  const { f, l } = inwardLines(entries);
  formulationSheet(wb, f);
  labSheet(wb, l);
  return finish(wb);
}

/** Every Production Sample form field, in form order (Basic Information → Body 1 … n: Design + Roy Body, L, a, b → Output → Remarks). */
function productionCols(entries: ProductionDetail[]): Col<ProductionDetail>[] {
  const read = (list: ReadingDTO[] | undefined, stage: ReadingDTO["stage"], i: number) => list?.find((m) => m.stage === stage && m.bodyIndex === i);
  const n = bodyCount(entries);
  const cols: Col<ProductionDetail>[] = [
    { group: "Basic Information", header: "Date", width: 13, kind: "date", value: (e) => dateOnly(e.sampleDate) },
    { group: "Basic Information", header: "S. No.", width: 8, kind: "number", value: (e) => e.serialNo },
    { group: "Basic Information", header: "Slab Number", width: 12, kind: "number", value: (e) => e.slabNumber },
    { group: "Basic Information", header: "Design Name", width: 22, value: (e) => e.designName },
    { group: "Basic Information", header: "Number of Bodies", width: 10, kind: "number", value: (e) => e.numberOfBodies },
  ];
  for (let i = 1; i <= n; i++) {
    const b = (e: ProductionDetail) => e.bodies[i - 1];
    const B = (name: string) => `Body ${i} · ${name}`;
    // This body's Roy Body readings only when some entry has a Roy Body on this body.
    const roys = entries.map((e) => b(e)?.royBody).filter((r): r is NonNullable<ProductionDetail["bodies"][number]["royBody"]> => !!r);
    const royN = Math.max(1, ...roys.map((r) => r.numberOfBodies ?? 0));
    const royReadings: Col<ProductionDetail>[] = [];
    if (roys.length) {
      for (let k = 1; k <= royN; k++) {
        royReadings.push(
          ...bodyLabCols<ProductionDetail>(B("Roy Body — L, a, b"), [
            { title: `Roy Body ${k} Post Press`, get: (e) => read(b(e)?.royBody?.readings, "POST_PRESS", k) },
            { title: `Roy Body ${k} Post Polish`, get: (e) => read(b(e)?.royBody?.readings, "POST_POLISH", k) },
          ]),
        );
      }
    }
    cols.push(
      { group: B("Design"), header: "Design", width: 15, value: (e) => designLabel(b(e)?.designCategory ?? null) },
      { group: B("Design"), header: "Design Pattern(s)", width: 28, value: (e) => (b(e) ? labels(b(e)!.designPatterns) : null) },
      { group: B("Roy Body — Design"), header: "Roy Body — Number of Bodies", width: 12, kind: "number", value: (e) => b(e)?.royBody?.numberOfBodies },
      ...royReadings,
      ...bodyLabCols<ProductionDetail>(B("L, a, b"), [
        { title: "Post Press", get: (e) => b(e)?.postPress },
        { title: "Post Polish", get: (e) => b(e)?.postPolish },
      ]),
    );
  }
  cols.push(
    { group: "Sample Output & Remarks", header: "Output Files", width: 28, value: (e) => e.attachments.map((a) => a.originalName).join(", ") },
    { group: "Sample Output & Remarks", header: "Remarks", width: 36, value: (e) => e.remarks },
    { group: "Record", header: "Created By", width: 16, value: (e) => e.createdBy },
    { group: "Record", header: "Created At", width: 18, kind: "datetime", value: (e) => plantDateTime(e.createdAt) },
    { group: "Record", header: "Last Updated By", width: 16, value: (e) => e.updatedBy },
    { group: "Record", header: "Last Updated At", width: 18, kind: "datetime", value: (e) => plantDateTime(e.updatedAt) },
  );
  return cols;
}

/** One line per production reading, body by body (and each body's Roy Body). */
function productionLines(entries: ProductionDetail[]): LabLine[] {
  const lines: LabLine[] = [];
  const ref = (e: ProductionDetail) => `S. No. ${e.serialNo}${e.slabNumber ? ` / Slab ${e.slabNumber}` : ""}`;
  for (const e of entries) {
    for (const b of e.bodies) {
      if (b.postPress) lines.push({ source: "Production Sample", ref: ref(e), stage: "Post Press", body: b.index, ...b.postPress });
      if (b.postPolish) lines.push({ source: "Production Sample", ref: ref(e), stage: "Post Polish", body: b.index, ...b.postPolish });
      for (const m of b.royBody?.readings ?? [])
        lines.push({ source: "Production Sample", ref: ref(e), stage: `Body ${b.index} · Roy Body — Design · ${stageName(m.stage)}`, body: m.bodyIndex, l: m.l, a: m.a, b: m.b });
    }
  }
  return lines;
}

/** Production Sample Data for a Production Date: one row per production sample, plus an "L a b" sheet with one line per reading. */
export async function productionWorkbook(entries: ProductionDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addSheet<ProductionDetail>(wb, "Production Samples", productionCols(entries), entries, { emptyNote: "No production samples for the selected Production Date." });
  labSheet(wb, productionLines(entries));
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
      ...sampleCols<CompleteRow>((r) => r.sample, bodyCount(samples), "Data Entry · "),
      ...sampleRecordCols<CompleteRow>((r) => r.sample, "Data Entry · "),
      ...inwardCols<CompleteRow>((r) => r.inward, bodyCount(entries), "Inward / Outward · "),
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
  const lab = (r: FilteredRow) => (r.source === "lab" ? r.sample : null);
  const cols: Col<FilteredRow>[] = [
    { header: "S.No.", width: 8, kind: "number", value: (r) => r.serialNo },
    { header: "Slab Number", width: 12, kind: "number", value: (r) => r.slabNumber },
    { header: "Date", width: 13, kind: "date", value: (r) => dateOnly(r.date) },
    { header: "Status", width: 10, value: (r) => (lab(r) ? (lab(r)!.status === "DRAFT" ? "Draft" : "Saved") : null) },
    { header: "Sample Type", width: 18, value: (r) => r.typeLabel },
    { header: "Number of Bodies", width: 10, kind: "number", value: (r) => r.bodies || null },
    { header: "Design", width: 15, value: (r) => r.design.categories.map((c) => designLabel(c)).join(", ") || null },
    { header: "Design Pattern(s)", width: 28, value: (r) => labels(r.design.patterns) },
    {
      header: "Design Source",
      width: 18,
      value: (r) => (r.design.source ? { inward: "Inward / Outward", sample: "Data Entry", production: "Production Sample" }[r.design.source] : null),
    },
    { header: "Mixer Type", width: 12, value: (r) => (lab(r) ? unionLabels(lab(r)!.bodies.map((b) => (b.mixerType ? [b.mixerType] : []))).join(", ") : null) },
    { header: "How Vein Introduced", width: 24, value: (r) => (lab(r) ? unionLabels(lab(r)!.bodies.map((b) => b.veinMethods)).join(", ") : null) },
  ];
  const none = "No samples match the selected Production Date and filters.";
  addSheet<FilteredRow>(wb, "Filtered Samples", cols, rows, { emptyNote: none });

  // Full form columns for exactly the same records.
  const samples = rows.flatMap((r) => (r.source === "lab" ? [r.sample] : []));
  const productions = rows.flatMap((r) => (r.source === "production" ? [r.production] : []));
  if (wantsLab(filters)) {
    addSheet<SampleDetail>(wb, "Sample Details", [...sampleCols<SampleDetail>((s) => s, bodyCount(samples)), ...sampleRecordCols<SampleDetail>((s) => s)], samples, {
      emptyNote: "No lab samples match the selected Production Date and filters.",
    });
  }
  if (wantsProduction(filters)) {
    addSheet<ProductionDetail>(wb, "Production Sample Details", productionCols(productions), productions, {
      emptyNote: "No production samples match the selected Production Date and filters.",
    });
  }

  const fs = wb.addWorksheet("Filters Applied");
  fs.columns = [{ width: 24 }, { width: 40 }];
  const head = fs.addRow(["Filter", "Value"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  for (const [k, v] of [
    ["Production Date", periodLabel(filters.period)],
    ["Sample Type", labelsFor.sampleType ?? "All sample types"],
    ["Design", labelsFor.design ?? "Any"],
    ["Design Pattern", labelsFor.pattern ?? "Any"],
    ["Matching samples", String(rows.length)],
  ])
    fs.addRow([k, v]);
  return finish(wb);
}

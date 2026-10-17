import "server-only";
import ExcelJS from "exceljs";
import { DESIGN_TYPES, designType, typeOfPattern, type DesignTypeKey } from "@/modules/forms/design-types";
import { inwardDesignText } from "@/modules/inward-outward/design-text";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { ProductionDetail } from "@/modules/production/queries";
import { bodiesDesignText, veinDetailsText } from "@/modules/samples/bodies";
import type { FormulationDTO, LabValueDTO, SampleBodyDTO, SampleDetail } from "@/modules/samples/queries";
import { componentText, filterLabels, sampleTypeOption, type ExportFilters, type FilteredRow } from "./filters";
import { periodLabel } from "./period";

/*
 * Excel reports of the three forms. Each report has
 *  - one sheet with a row per record and every field of its form, in the
 *    form's order (Body 1 … N, Roy Body 1 … n, Chessboard Body 1 … n as
 *    column groups), plus what an earlier form recorded when there is any;
 *  - detail sheets with one line per material / colour and per L, a, b
 *    reading, for sorting and pivot tables.
 */

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
const NO_RECORDS = "No records for the selected Production Date.";

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
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
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
    const row = ws.addRow(
      cols.map((c) => {
        const v = c.value(r);
        return v === undefined || v === "" ? null : v;
      }),
    );
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
    ws.addRow([opts.emptyNote ?? NO_RECORDS]).font = { italic: true, color: { argb: "FF7A8896" } };
  }
  return ws;
}

/** Two-column sheet: what was chosen. */
function addInfoSheet(wb: ExcelJS.Workbook, name: string, pairs: [string, string][]) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 24 }, { width: 44 }];
  const head = ws.addRow(["Filter", "Value"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  for (const p of pairs) ws.addRow(p);
}

async function finish(wb: ExcelJS.Workbook): Promise<Buffer> {
  wb.creator = "Pacific Surfaces Lab ERP";
  wb.created = new Date();
  return Buffer.from(await wb.xlsx.writeBuffer());
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
const yesNo = (b: boolean | null | undefined) => (b === null || b === undefined ? null : b ? "Yes" : "No");
const labels = (xs: { label: string }[] | undefined) => xs?.map((x) => x.label).join(", ") || null;
const gm = (q: string | null) => (q === null ? "" : ` ${Number(q)} gm`);
const maxOf = (xs: number[], floor = 1) => Math.max(floor, ...xs);
const range = (n: number) => Array.from({ length: n }, (_, k) => k + 1);

// ── Material Details ─────────────────────────────────────────────────────────

type Materials = Pick<FormulationDTO, "components" | "additives"> | null | undefined;
type MaterialKey = "RESIN" | "GRIT" | "FILLER" | "PIGMENT" | "ADDITIVE";

/** The form's Material Details, in its order (Material Choices, then Pigments / Additives). */
const MATERIALS: { key: MaterialKey; label: string }[] = [
  { key: "RESIN", label: "Resin" },
  { key: "GRIT", label: "Grits" },
  { key: "FILLER", label: "Filler" },
  { key: "PIGMENT", label: "Pigments (Color Used)" },
  { key: "ADDITIVE", label: "Additives" },
];

/** "INEOS 1200 gm; Q2 (Coarse) 300 gm" — one category of a body's materials. */
function materialsText(m: Materials, key: MaterialKey): string | null {
  if (!m) return null;
  const parts = key === "ADDITIVE" ? m.additives.map((a) => `${a.additive.label}${gm(a.quantity)}`) : m.components.filter((c) => c.kind === key).map(componentText);
  return parts.join("; ") || null;
}

/** All categories of a formulation in one cell (earlier-form Roy Bodies). */
function formulationText(m: Materials): string {
  return MATERIALS.map(({ key, label }) => {
    const t = materialsText(m, key);
    return t ? `${label}: ${t}` : null;
  })
    .filter(Boolean)
    .join(" | ");
}

function materialCols<T>(group: string, get: (r: T) => Materials): Col<T>[] {
  return MATERIALS.map(({ key, label }) => ({ group, header: label, width: 28, value: (r: T) => materialsText(get(r), key) }));
}

// ── L, a, b ──────────────────────────────────────────────────────────────────

type Reading = LabValueDTO | null | undefined;

/** L, a, b of one body: one reading, or Post Press + Post Polish. */
function readingCols<T>(group: string, stages: { title?: string; get: (r: T) => Reading }[]): Col<T>[] {
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

const stageCols = <T>(group: string, get: (r: T) => { postPress: Reading; postPolish: Reading } | null | undefined) =>
  readingCols<T>(group, [
    { title: "Post Press", get: (r) => get(r)?.postPress },
    { title: "Post Polish", get: (r) => get(r)?.postPolish },
  ]);

// ── design types (Lab Sample and Inward / Outward) ───────────────────────────

interface TypeDetail {
  type: DesignTypeKey;
  bodyCount: number | null;
  veinPresent: boolean | null;
  mixerType: { label: string } | null;
  veinDetails: { label: string }[];
  colours: { colour: { label: string }; quantity: string | null }[];
}

const coloursText = (cs: TypeDetail["colours"] | undefined) => cs?.map((c) => `${c.colour.label}${gm(c.quantity)}`).join("; ") || null;

/** The section of each design type, in the form's order; `extra` adds a type's own bodies (Lab Sample). */
function typeDetailCols<T>(get: (r: T) => { plainBody: boolean | null; designTypes: TypeDetail[] }, extra: (k: DesignTypeKey) => Col<T>[] = () => []): Col<T>[] {
  const t = (r: T, k: DesignTypeKey) => {
    const d = get(r);
    return d.plainBody === false ? d.designTypes.find((x) => x.type === k) : undefined;
  };
  const veinCols = (k: "KREOS" | "VEIN", group: string, colours: string): Col<T>[] => [
    { group, header: "Vein Present", width: 10, value: (r) => yesNo(t(r, k)?.veinPresent) },
    { group, header: "Mixer Type", width: 14, value: (r) => t(r, k)?.mixerType?.label },
    { group, header: "Vein Details", width: 22, value: (r) => labels(t(r, k)?.veinDetails) },
    { group, header: colours, width: 30, value: (r) => coloursText(t(r, k)?.colours) },
  ];
  return DESIGN_TYPES.flatMap(({ key }): Col<T>[] => {
    switch (key) {
      case "ROY_BODY":
        return [{ group: "Roy Body Details", header: "Number of Roy Body (n)", width: 12, kind: "number", value: (r) => t(r, key)?.bodyCount }, ...extra(key)];
      case "KREOS":
        return [...veinCols(key, "Kreos Vein Details", "Kreos Vein Colors Used"), ...extra(key)];
      case "CARRARA":
        return [{ group: "Carrara Details", header: "Carrara Colors Used", width: 30, value: (r) => coloursText(t(r, key)?.colours) }, ...extra(key)];
      case "VEIN":
        return [...veinCols(key, "Vein Details", "Vein Colors Used"), ...extra(key)];
      case "CHESSBOARD":
        return [{ group: "Chessboard Details", header: "Number of Chessboard Body (n)", width: 12, kind: "number", value: (r) => t(r, key)?.bodyCount }, ...extra(key)];
    }
  });
}

const plainBodyCol = <T>(group: string, get: (r: T) => boolean | null): Col<T> => ({ group, header: "Plain Body", width: 10, value: (r) => yesNo(get(r)) });
const typesCol = <T>(group: string, get: (r: T) => { plainBody: boolean | null; designTypes: { type: DesignTypeKey }[] }): Col<T> => ({
  group,
  header: "Design Types",
  width: 26,
  value: (r) => (get(r).plainBody === false ? get(r).designTypes.map((x) => designType(x.type).label).join(", ") : null),
});

/** Sample Output, Remarks and who recorded it. */
function closingCols<T>(get: (r: T) => { attachments: { originalName: string }[]; remarks: string | null; createdBy: string | null; createdAt: string; updatedBy: string | null; updatedAt: string }): Col<T>[] {
  return [
    { group: "Sample Output", header: "Output Files", width: 30, value: (r) => get(r).attachments.map((a) => a.originalName).join(", ") },
    { group: "Remarks", header: "Remarks", width: 36, value: (r) => get(r).remarks },
    { group: "Record", header: "Created By", width: 16, value: (r) => get(r).createdBy },
    { group: "Record", header: "Created At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r).createdAt) },
    { group: "Record", header: "Last Updated By", width: 16, value: (r) => get(r).updatedBy },
    { group: "Record", header: "Last Updated At", width: 18, kind: "datetime", value: (r) => plantDateTime(get(r).updatedAt) },
  ];
}

// ── detail sheets (one line per material / colour, per reading) ──────────────

interface RecordRef {
  date: string;
  serialNo: number;
  slabNumber: number | null;
  designName: string | null;
}

interface MaterialLine extends RecordRef {
  part: string;
  category: string;
  material: string | null;
  size: string | null;
  quantity: string | null;
  /** A quantity recorded in % by an early form. */
  percent: boolean;
}

interface ReadingLine extends RecordRef {
  part: string;
  stage: string | null;
  l: string | null;
  a: string | null;
  b: string | null;
}

const refCols = <T extends RecordRef>(): Col<T>[] => [
  { header: "Date", width: 13, kind: "date", value: (l) => dateOnly(l.date) },
  { header: "S.No.", width: 8, kind: "number", value: (l) => l.serialNo },
  { header: "Slab Number", width: 12, kind: "number", value: (l) => l.slabNumber },
  { header: "Design Name", width: 22, value: (l) => l.designName },
];

function materialSheet(wb: ExcelJS.Workbook, name: string, lines: MaterialLine[]) {
  addSheet<MaterialLine>(
    wb,
    name,
    [
      ...refCols<MaterialLine>(),
      { header: "Part", width: 30, value: (l) => l.part },
      { header: "Category", width: 22, value: (l) => l.category },
      { header: "Material / Color", width: 24, value: (l) => l.material },
      { header: "Size of Grit", width: 14, value: (l) => l.size },
      { header: "Quantity (gm)", width: 14, kind: "number", value: (l) => (l.percent ? null : num(l.quantity)) },
      // Only for values saved before the % option was removed.
      { header: "Note", width: 16, value: (l) => (l.percent && l.quantity !== null ? `recorded as ${Number(l.quantity)} %` : null) },
    ],
    lines,
    { emptyNote: "No materials recorded." },
  );
}

function readingSheet(wb: ExcelJS.Workbook, lines: ReadingLine[]) {
  const staged = lines.some((l) => l.stage);
  addSheet<ReadingLine>(
    wb,
    "L a b",
    [
      ...refCols<ReadingLine>(),
      { header: "Body", width: 34, value: (l) => l.part },
      ...(staged ? [{ header: "Stage", width: 14, value: (l: ReadingLine) => l.stage } as Col<ReadingLine>] : []),
      { header: "L", width: 10, kind: "number", value: (l) => num(l.l) },
      { header: "a", width: 10, kind: "number", value: (l) => num(l.a) },
      { header: "b", width: 10, kind: "number", value: (l) => num(l.b) },
    ],
    lines,
    { emptyNote: "No L, a, b readings recorded." },
  );
}

function pushMaterials(out: MaterialLine[], ref: RecordRef, part: string, m: Materials) {
  for (const c of m?.components ?? []) {
    out.push({
      ...ref,
      part,
      category: MATERIALS.find((x) => x.key === c.kind)!.label,
      material: c.material?.label ?? null,
      size: c.size?.label ?? null,
      quantity: c.quantity,
      percent: c.unit === "PERCENT",
    });
  }
  for (const a of m?.additives ?? []) out.push({ ...ref, part, category: "Additives", material: a.additive.label, size: null, quantity: a.quantity, percent: false });
}

function pushColours(out: MaterialLine[], ref: RecordRef, plainBody: boolean | null, types: TypeDetail[]) {
  if (plainBody !== false) return;
  for (const t of types)
    for (const c of t.colours)
      out.push({ ...ref, part: `${designType(t.type).label} (Design Type)`, category: "Colors Used", material: c.colour.label, size: null, quantity: c.quantity, percent: false });
}

const pushReading = (out: ReadingLine[], ref: RecordRef, part: string, stage: string | null, r: Reading) => {
  if (r && (r.l !== null || r.a !== null || r.b !== null)) out.push({ ...ref, part, stage, l: r.l, a: r.a, b: r.b });
};
const stageName = (st: "POST_PRESS" | "POST_POLISH") => (st === "POST_PRESS" ? "Post Press" : "Post Polish");

// ── Lab Sample Reports ───────────────────────────────────────────────────────

const labRef = (s: SampleDetail): RecordRef => ({ date: s.sampleDate, serialNo: s.serialNo, slabNumber: s.slabNumber, designName: s.designName });

const bodyHasEarlier = (b: SampleBodyDTO) =>
  b.hasVein !== null || !!b.mixerType || b.veinMethods.length > 0 || b.veinDetails.length > 0 || !!b.veinNotes || !!b.designRoyBody || !!b.veinRoyBody;
const perBodyDesign = (s: SampleDetail) => s.bodies.length > 1 && new Set(s.bodies.map((b) => `${b.designCategory}|${b.designPatterns.map((p) => p.id).join()}`)).size > 1;
const labEarlier = (s: SampleDetail) =>
  s.status === "DRAFT" || s.physicalSamplePresent !== null || !!s.inwardEntry || s.otherPatterns.length > 0 || perBodyDesign(s) || s.bodies.some(bodyHasEarlier);

/**
 * The bodies that hold their own materials and earlier-form details. A sample
 * of the earliest form recorded them once for the whole sample (shown on every
 * body in Review): exported once, so quantities are not counted N times.
 */
const ownBodies = (s: SampleDetail) => (s.legacyBodies ? s.bodies.slice(0, 1) : s.bodies);
const bodyName = (s: SampleDetail, b: SampleBodyDTO) => (s.legacyBodies ? "Whole sample" : `Body ${b.index}`);

/** "Body 1: …\nBody 2: …" — one earlier-form detail per body. */
const perBody = (s: SampleDetail, text: (b: SampleBodyDTO) => string | null) =>
  ownBodies(s)
    .map((b) => {
      const t = text(b);
      return t ? `${bodyName(s, b)}: ${t}` : null;
    })
    .filter(Boolean)
    .join("\n") || null;

function labCols(samples: SampleDetail[]): Col<SampleDetail>[] {
  const n = maxOf(samples.map((s) => s.bodies.length));
  const roy = maxOf(samples.map((s) => s.royBodies.length), 0);
  const chess = maxOf(samples.map((s) => s.chessboardBodies.length), 0);
  const DT = "Design Type and Number of Bodies";
  const special = (k: DesignTypeKey): Col<SampleDetail>[] =>
    k === "ROY_BODY"
      ? range(roy).flatMap((i) => materialCols<SampleDetail>(`Roy Body ${i} · Material Details`, (s) => s.royBodies[i - 1]?.materials))
      : k === "CHESSBOARD"
        ? range(chess).flatMap((i) => materialCols<SampleDetail>(`Chessboard Body ${i} · Material Details`, (s) => s.chessboardBodies[i - 1]?.materials))
        : [];

  const cols: Col<SampleDetail>[] = [
    { group: "Basic Information", header: "Date", width: 13, kind: "date", value: (s) => dateOnly(s.sampleDate) },
    { group: "Basic Information", header: "S.No.", width: 8, kind: "number", value: (s) => s.serialNo },
    { group: "Basic Information", header: "Slab Number", width: 12, kind: "number", value: (s) => s.slabNumber },
    { group: "Basic Information", header: "Design Name", width: 22, value: (s) => s.designName },
    plainBodyCol<SampleDetail>(DT, (s) => s.plainBody),
    typesCol<SampleDetail>(DT, (s) => s),
    { group: DT, header: "Number of Bodies (N)", width: 10, kind: "number", value: (s) => s.numberOfBodies ?? (s.bodies.length || null) },
    ...range(n).flatMap((i) => materialCols<SampleDetail>(`Material Details · Body ${i}`, (s) => ownBodies(s)[i - 1]?.main)),
    ...typeDetailCols<SampleDetail>((s) => s, special),
    ...range(n).flatMap((i) => stageCols<SampleDetail>(`L, a, b · Body ${i}`, (s) => s.bodies[i - 1])),
    ...range(roy).flatMap((i) => stageCols<SampleDetail>(`L, a, b · Roy Body ${i}`, (s) => s.royBodies[i - 1])),
    ...range(chess).flatMap((i) => stageCols<SampleDetail>(`L, a, b · Chessboard Body ${i}`, (s) => s.chessboardBodies[i - 1])),
    ...closingCols<SampleDetail>((s) => s),
  ];

  if (samples.some(labEarlier)) {
    const E = "Recorded with the earlier form";
    cols.push(
      { group: E, header: "Saved as", width: 10, value: (s) => (s.status === "DRAFT" ? "Draft" : null) },
      { group: E, header: "Material Details", width: 26, value: (s) => (s.legacyBodies && s.bodies.length > 1 ? "Recorded once for the whole sample (under Body 1)" : null) },
      { group: E, header: "Physical Sample Available", width: 12, value: (s) => yesNo(s.physicalSamplePresent) },
      { group: E, header: "Inward / Outward S.No.", width: 10, kind: "number", value: (s) => s.inwardEntry?.serialNo },
      {
        group: E,
        header: "Design per body",
        width: 30,
        value: (s) => (perBodyDesign(s) ? bodiesDesignText(s.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns }))) : null),
      },
      { group: E, header: "Other design patterns", width: 22, value: (s) => labels(s.otherPatterns) },
      {
        group: E,
        header: "Vein (per body)",
        width: 40,
        value: (s) =>
          perBody(s, (b) =>
            b.hasVein === null && !b.mixerType && !b.veinMethods.length && !b.veinDetails.length && !b.veinNotes
              ? null
              : [
                  b.hasVein === null ? null : `Vein ${b.hasVein ? "Yes" : "No"}`,
                  b.mixerType ? `Mixer Type: ${b.mixerType.label}` : null,
                  b.veinMethods.length ? `How Vein Introduced: ${labels(b.veinMethods)}` : null,
                  veinDetailsText(b.veinDetails, b.veinNotes) ? `Vein Details: ${veinDetailsText(b.veinDetails, b.veinNotes)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
          ),
      },
      {
        group: E,
        header: "Roy Body Formulation — Design (per body)",
        width: 50,
        value: (s) =>
          perBody(s, (b) =>
            b.designRoyBody
              ? [
                  b.designRoyBody.numberOfBodies !== null ? `Number of Bodies ${b.designRoyBody.numberOfBodies}` : null,
                  b.designRoyBody.hasVein !== null ? `Vein ${b.designRoyBody.hasVein ? "Yes" : "No"}` : null,
                  b.designRoyBody.mixerType ? `Mixer Type: ${b.designRoyBody.mixerType.label}` : null,
                  b.designRoyBody.veinMethods.length ? `How Vein Introduced: ${labels(b.designRoyBody.veinMethods)}` : null,
                  formulationText(b.designRoyBody) || null,
                  b.designRoyBody.veinRoyBody ? `Vein Roy Body — ${formulationText({ ...b.designRoyBody.veinRoyBody, additives: [] })}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null,
          ),
      },
      { group: E, header: "Roy Body Formulation — Vein (per body)", width: 50, value: (s) => perBody(s, (b) => (b.veinRoyBody ? formulationText(b.veinRoyBody) || "—" : null)) },
    );
  }
  return cols;
}

function labLines(samples: SampleDetail[]) {
  const m: MaterialLine[] = [];
  const r: ReadingLine[] = [];
  for (const s of samples) {
    const ref = labRef(s);
    for (const b of ownBodies(s)) pushMaterials(m, ref, bodyName(s, b), b.main);
    for (const b of s.royBodies) pushMaterials(m, ref, `Roy Body ${b.index}`, b.materials);
    for (const b of s.chessboardBodies) pushMaterials(m, ref, `Chessboard Body ${b.index}`, b.materials);
    pushColours(m, ref, s.plainBody, s.designTypes);
    for (const b of ownBodies(s)) {
      // What an earlier form recorded on this body.
      const B = bodyName(s, b);
      if (b.designRoyBody) {
        pushMaterials(m, ref, `${B} · Roy Body — Design`, b.designRoyBody);
        if (b.designRoyBody.veinRoyBody) pushMaterials(m, ref, `${B} · Roy Body — Design › Vein Roy Body`, { ...b.designRoyBody.veinRoyBody, additives: [] });
      }
      if (b.veinRoyBody) pushMaterials(m, ref, `${B} · Roy Body — Vein`, b.veinRoyBody);
    }

    for (const b of s.bodies) {
      pushReading(r, ref, `Body ${b.index}`, "Post Press", b.postPress);
      pushReading(r, ref, `Body ${b.index}`, "Post Polish", b.postPolish);
    }
    for (const b of s.royBodies) {
      pushReading(r, ref, `Roy Body ${b.index}`, "Post Press", b.postPress);
      pushReading(r, ref, `Roy Body ${b.index}`, "Post Polish", b.postPolish);
    }
    for (const b of s.chessboardBodies) {
      pushReading(r, ref, `Chessboard Body ${b.index}`, "Post Press", b.postPress);
      pushReading(r, ref, `Chessboard Body ${b.index}`, "Post Polish", b.postPolish);
    }
    for (const b of ownBodies(s))
      for (const x of b.designRoyBody?.measurements ?? []) pushReading(r, ref, `${bodyName(s, b)} · Roy Body — Design · Body ${x.bodyIndex}`, stageName(x.stage), x);
  }
  return { m, r };
}

function addLabSheets(wb: ExcelJS.Workbook, samples: SampleDetail[], emptyNote?: string) {
  addSheet<SampleDetail>(wb, "Lab Samples", labCols(samples), samples, { emptyNote });
  const { m, r } = labLines(samples);
  materialSheet(wb, "Material Details", m);
  readingSheet(wb, r);
}

/** Lab Sample Reports: every Lab Sample form field of the period's samples. */
export async function labWorkbook(samples: SampleDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addLabSheets(wb, samples, "No lab samples for the selected Production Date.");
  return finish(wb);
}

// ── Sample Inward / Outward Reports ──────────────────────────────────────────

const inwardRef = (e: InwardDetail): RecordRef => ({ date: e.entryDate, serialNo: e.serialNo, slabNumber: e.slabNumber, designName: e.sampleDesignName });
const inwardOtherPatterns = (e: InwardDetail) => (e.legacyBodies ? [] : (e.bodies[0]?.designPatterns ?? []).filter((p) => !typeOfPattern(p)));
/** Bodies with their own earlier-form Roy Body: per body for the earliest entries, else once for the entry. */
const inwardRoyBodies = (e: InwardDetail) => (e.legacyBodies ? e.bodies : e.bodies.slice(0, 1)).filter((b) => b.royBody);
const inwardBodyName = (e: InwardDetail, i: number) => (e.legacyBodies ? `Body ${i}` : "Whole sample");
const inwardEarlier = (e: InwardDetail) => e.legacyBodies || !!e.labSample || !!e.recreationAttempts || e.bodies.some((b) => b.royBody) || inwardOtherPatterns(e).length > 0;

function inwardCols(entries: InwardDetail[]): Col<InwardDetail>[] {
  const n = maxOf(entries.map((e) => e.bodies.length));
  const roy = maxOf(entries.map((e) => (e.designTypes.some((t) => t.type === "ROY_BODY") ? e.royBodies.length : 0)), 0);
  const chess = maxOf(entries.map((e) => (e.designTypes.some((t) => t.type === "CHESSBOARD") ? e.chessboardBodies.length : 0)), 0);
  const SD = "Sample Details";
  const DT = "Design Type and Bodies";
  const has = (e: InwardDetail, k: DesignTypeKey) => e.designTypes.some((t) => t.type === k);

  const cols: Col<InwardDetail>[] = [
    { group: SD, header: "Date", width: 13, kind: "date", value: (e) => dateOnly(e.entryDate) },
    { group: SD, header: "S.No.", width: 8, kind: "number", value: (e) => e.serialNo },
    { group: SD, header: "Slab Number", width: 12, kind: "number", value: (e) => e.slabNumber },
    { group: SD, header: "Company Name", width: 22, value: (e) => e.company?.label },
    { group: SD, header: "Design Name", width: 22, value: (e) => e.sampleDesignName },
    plainBodyCol<InwardDetail>(DT, (e) => e.plainBody),
    typesCol<InwardDetail>(DT, (e) => e),
    { group: DT, header: "Number of Bodies (N)", width: 10, kind: "number", value: (e) => e.numberOfBodies ?? (e.bodies.length || null) },
    ...typeDetailCols<InwardDetail>((e) => e),
    ...range(n).flatMap((i) => readingCols<InwardDetail>(`L, a, b · Body ${i}`, [{ get: (e) => e.bodies[i - 1]?.lab }])),
    ...range(roy).flatMap((i) => readingCols<InwardDetail>(`L, a, b · Roy Body ${i}`, [{ get: (e) => (has(e, "ROY_BODY") ? e.royBodies[i - 1] : null) }])),
    ...range(chess).flatMap((i) =>
      readingCols<InwardDetail>(`L, a, b · Chessboard Body ${i}`, [{ get: (e) => (has(e, "CHESSBOARD") ? e.chessboardBodies[i - 1] : null) }]),
    ),
    ...closingCols<InwardDetail>((e) => e),
  ];

  if (entries.some(inwardEarlier)) {
    const E = "Recorded with the earlier form";
    cols.push(
      {
        group: E,
        header: "Linked Lab Sample",
        width: 22,
        value: (e) => (e.labSample ? `S.No. ${e.labSample.serialNo}${e.labSample.slabNumber ? ` / Slab ${e.labSample.slabNumber}` : ""} (${e.labSample.sampleDate})` : null),
      },
      { group: E, header: "Design per body", width: 30, value: (e) => (e.legacyBodies ? inwardDesignText(e) : null) },
      { group: E, header: "Other design patterns", width: 22, value: (e) => labels(inwardOtherPatterns(e)) },
      { group: E, header: "Lab Recreation Attempts", width: 36, value: (e) => e.recreationAttempts },
      {
        group: E,
        header: "Roy Body Formulation (per body)",
        width: 50,
        value: (e) =>
          inwardRoyBodies(e)
            .map((b) => `${inwardBodyName(e, b.index)}: ${[b.royBody!.numberOfBodies !== null ? `Number of Bodies ${b.royBody!.numberOfBodies}` : null, formulationText(b.royBody) || null].filter(Boolean).join(" · ")}`)
            .join("\n") || null,
      },
    );
  }
  return cols;
}

function inwardLines(entries: InwardDetail[]) {
  const m: MaterialLine[] = [];
  const r: ReadingLine[] = [];
  for (const e of entries) {
    const ref = inwardRef(e);
    pushColours(m, ref, e.plainBody, e.designTypes);
    for (const b of inwardRoyBodies(e)) pushMaterials(m, ref, `${inwardBodyName(e, b.index)} · Roy Body — Design`, b.royBody);

    for (const b of e.bodies) pushReading(r, ref, `Body ${b.index}`, null, b.lab);
    if (e.designTypes.some((t) => t.type === "ROY_BODY")) e.royBodies.forEach((x, k) => pushReading(r, ref, `Roy Body ${k + 1}`, null, x));
    if (e.designTypes.some((t) => t.type === "CHESSBOARD")) e.chessboardBodies.forEach((x, k) => pushReading(r, ref, `Chessboard Body ${k + 1}`, null, x));
    for (const b of inwardRoyBodies(e))
      for (const x of b.royBody?.measurements ?? []) pushReading(r, ref, `${inwardBodyName(e, b.index)} · Roy Body — Design · Body ${x.bodyIndex}`, stageName(x.stage), x);
  }
  return { m, r };
}

function addInwardSheets(wb: ExcelJS.Workbook, entries: InwardDetail[], emptyNote?: string) {
  addSheet<InwardDetail>(wb, "Inward Outward Samples", inwardCols(entries), entries, { emptyNote });
  const { m, r } = inwardLines(entries);
  materialSheet(wb, "Colors & Materials", m);
  readingSheet(wb, r);
}

/** Sample Inward/Outward Reports: every Inward / Outward form field of the period's entries. */
export async function inwardWorkbook(entries: InwardDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addInwardSheets(wb, entries, "No inward / outward samples for the selected Production Date.");
  return finish(wb);
}

// ── Production Sample Reports ────────────────────────────────────────────────

const productionRef = (p: ProductionDetail): RecordRef => ({ date: p.sampleDate, serialNo: p.serialNo, slabNumber: p.slabNumber, designName: p.designName });
/** Bodies with their own earlier-form Roy Body (entries saved before body-wise entry recorded one for the whole sample). */
const productionRoyBodies = (p: ProductionDetail) => (p.legacyBodies ? p.bodies.slice(0, 1) : p.bodies).filter((b) => b.royBody);
const productionBodyName = (p: ProductionDetail, i: number) => (p.legacyBodies ? "Whole sample" : `Body ${i}`);
const productionEarlier = (p: ProductionDetail) => p.bodies.some((b) => b.designCategory !== null || b.designPatterns.length > 0 || b.royBody);

function productionCols(entries: ProductionDetail[]): Col<ProductionDetail>[] {
  const n = maxOf(entries.map((p) => p.bodies.length));
  const BI = "Basic Information";
  const cols: Col<ProductionDetail>[] = [
    { group: BI, header: "Date", width: 13, kind: "date", value: (p) => dateOnly(p.sampleDate) },
    { group: BI, header: "S.No.", width: 8, kind: "number", value: (p) => p.serialNo },
    { group: BI, header: "Slab Number", width: 12, kind: "number", value: (p) => p.slabNumber },
    { group: BI, header: "Design Name", width: 22, value: (p) => p.designName },
    { group: BI, header: "Number of Bodies (N)", width: 10, kind: "number", value: (p) => p.numberOfBodies ?? (p.bodies.length || null) },
    ...range(n).flatMap((i) => stageCols<ProductionDetail>(`L, a, b · Body ${i}`, (p) => p.bodies[i - 1])),
    ...closingCols<ProductionDetail>((p) => p),
  ];
  if (entries.some(productionEarlier)) {
    const E = "Recorded with the earlier form";
    cols.push(
      {
        group: E,
        header: "Design per body",
        width: 30,
        value: (p) => (productionEarlier(p) ? bodiesDesignText(p.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns }))) || null : null),
      },
      {
        group: E,
        header: "Roy Body — Number of Bodies (per body)",
        width: 24,
        value: (p) =>
          productionRoyBodies(p)
            .map((b) => `${productionBodyName(p, b.index)}: ${b.royBody!.numberOfBodies ?? "—"}`)
            .join("\n") || null,
      },
    );
  }
  return cols;
}

function productionLines(entries: ProductionDetail[]): ReadingLine[] {
  const r: ReadingLine[] = [];
  for (const p of entries) {
    const ref = productionRef(p);
    for (const b of p.bodies) {
      pushReading(r, ref, `Body ${b.index}`, "Post Press", b.postPress);
      pushReading(r, ref, `Body ${b.index}`, "Post Polish", b.postPolish);
    }
    for (const b of productionRoyBodies(p))
      for (const x of b.royBody!.readings) pushReading(r, ref, `${productionBodyName(p, b.index)} · Roy Body ${x.bodyIndex}`, stageName(x.stage), x);
  }
  return r;
}

function addProductionSheets(wb: ExcelJS.Workbook, entries: ProductionDetail[], emptyNote?: string) {
  addSheet<ProductionDetail>(wb, "Production Samples", productionCols(entries), entries, { emptyNote });
  readingSheet(wb, productionLines(entries));
}

/** Production Sample Reports: every Production Sample form field of the period's samples. */
export async function productionWorkbook(entries: ProductionDetail[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addProductionSheets(wb, entries, "No production samples for the selected Production Date.");
  return finish(wb);
}

// ── Filtered Data Export ─────────────────────────────────────────────────────

/** The matching records: a summary sheet, then the complete form data of exactly those records. */
export async function filteredWorkbook(rows: FilteredRow[], filters: ExportFilters): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const type = sampleTypeOption(filters.sampleType);
  const none = "No records match the selected Production Date and filters.";
  addSheet<FilteredRow>(
    wb,
    "Filtered Records",
    [
      { header: "Date", width: 13, kind: "date", value: (r) => dateOnly(r.date) },
      { header: "S.No.", width: 8, kind: "number", value: (r) => r.serialNo },
      { header: "Slab Number", width: 12, kind: "number", value: (r) => r.slabNumber },
      { header: "Sample Type", width: 22, value: () => type.record },
      { header: "Sample Design", width: 24, value: (r) => r.designName },
      { header: "Design Type", width: 28, value: (r) => r.designTypes.join(", ") },
      { header: "Number of Bodies", width: 10, kind: "number", value: (r) => r.numberOfBodies },
    ],
    rows,
    { emptyNote: none },
  );

  if (filters.sampleType === "LAB") addLabSheets(wb, rows.flatMap((r) => (r.source === "LAB" ? [r.sample] : [])), none);
  if (filters.sampleType === "INWARD") addInwardSheets(wb, rows.flatMap((r) => (r.source === "INWARD" ? [r.inward] : [])), none);
  if (filters.sampleType === "PRODUCTION") addProductionSheets(wb, rows.flatMap((r) => (r.source === "PRODUCTION" ? [r.production] : [])), none);

  const l = filterLabels(filters);
  addInfoSheet(wb, "Filters Applied", [
    ["Production Date", periodLabel(filters.period)],
    ["Sample Type", l.sampleType],
    ["Sample Design", l.sampleDesign],
    ["Design Type", l.designType],
    ["Matching records", String(rows.length)],
  ]);
  return finish(wb);
}

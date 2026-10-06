/**
 * Report aggregation — pure functions, no database, so they are unit-tested.
 *
 * The date basis is the sample's Date field (what the lab records), not the
 * moment the row was typed in. Drafts count: a draft is still a slab made.
 */

export const REPORT_RANGES = [7, 15, 30] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export type MaterialKind = "RESIN" | "GRIT" | "FILLER" | "PIGMENT";
export const MATERIAL_KINDS: { kind: MaterialKind; label: string }[] = [
  { kind: "RESIN", label: "Resin" },
  { kind: "GRIT", label: "Grits" },
  { kind: "FILLER", label: "Filler" },
  { kind: "PIGMENT", label: "Pigments" },
];

/** Most materials drawn as their own stack segment; the rest fold into "Other". */
export const MAX_MATERIAL_SERIES = 6;
export const OTHER = "Other";

export interface ReportSampleRow {
  date: string; // YYYY-MM-DD
  /** Design names across the sample's bodies: "Plain Body", patterns, or "Non-Plain (no pattern)" — each once. */
  designs: string[];
  components: { kind: MaterialKind; material: string | null; unit: "GRAMS" | "PERCENT" | null; quantity: number | null }[];
}

export interface ConsumptionData {
  /** Total grams in the period (all materials of this kind). */
  totalGrams: number;
  /** Materials in stack order (largest first), possibly ending with "Other". */
  series: string[];
  /** One row per date: { date, [material]: grams }. */
  byDate: Array<Record<string, number | string>>;
  /** Per-material totals, largest first (every material, not folded). */
  byMaterial: { material: string; grams: number }[];
  /** Rows recorded in % — a share of a batch, not a weight, so not summed. */
  percentRows: number;
  /** Rows with a material but no quantity. */
  missingQtyRows: number;
}

export interface ReportData {
  days: ReportRange;
  from: string;
  to: string;
  dates: string[];
  totals: { samples: number; withoutDesign: number; productionSamples: number };
  production: { date: string; count: number }[];
  /** Production Samples (received from the plant) per date, from their Date field. */
  productionSamples: { date: string; count: number }[];
  designs: { pattern: string; count: number }[];
  consumption: Record<MaterialKind, ConsumptionData>;
}

/** The N calendar days ending `today` (inclusive), oldest first. */
export function dateWindow(today: string, days: number): string[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function parseRange(raw: string | undefined): ReportRange {
  const n = Number(raw);
  return (REPORT_RANGES as readonly number[]).includes(n) ? (n as ReportRange) : 7;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * @param productionDates the Date (YYYY-MM-DD) of every Production Sample —
 *   one entry per sample; dates outside the window are ignored.
 */
export function buildReport(rows: ReportSampleRow[], today: string, days: ReportRange, productionDates: string[] = []): ReportData {
  const dates = dateWindow(today, days);
  const inRange = new Set(dates);
  const samples = rows.filter((r) => inRange.has(r.date));
  const productionPerDate = new Map(dates.map((d) => [d, 0]));
  for (const d of productionDates) if (productionPerDate.has(d)) productionPerDate.set(d, productionPerDate.get(d)! + 1);
  const productionSamples = dates.map((date) => ({ date, count: productionPerDate.get(date)! }));

  const perDate = new Map(dates.map((d) => [d, 0]));
  const designCounts = new Map<string, number>();
  let withoutDesign = 0;

  for (const s of samples) {
    perDate.set(s.date, perDate.get(s.date)! + 1);

    // Each sample counts once per design pattern it carries (on any body).
    const designs = [...new Set(s.designs)];
    if (!designs.length) withoutDesign++;
    for (const d of designs) designCounts.set(d, (designCounts.get(d) ?? 0) + 1);
  }

  const consumption = {} as Record<MaterialKind, ConsumptionData>;
  for (const { kind } of MATERIAL_KINDS) {
    const totals = new Map<string, number>();
    const cell = new Map<string, Map<string, number>>(); // date → material → grams
    let percentRows = 0;
    let missingQtyRows = 0;
    for (const s of samples) {
      for (const c of s.components) {
        if (c.kind !== kind) continue;
        if (c.unit === "PERCENT") {
          percentRows++;
          continue;
        }
        if (c.quantity === null) {
          if (c.material) missingQtyRows++;
          continue;
        }
        // Quantity typed without a unit is treated as grams (the form's default reading).
        const name = c.material ?? "Unspecified";
        totals.set(name, (totals.get(name) ?? 0) + c.quantity);
        const m = cell.get(s.date) ?? new Map<string, number>();
        m.set(name, (m.get(name) ?? 0) + c.quantity);
        cell.set(s.date, m);
      }
    }
    const byMaterial = [...totals.entries()]
      .map(([material, grams]) => ({ material, grams: round(grams) }))
      .sort((a, b) => b.grams - a.grams || a.material.localeCompare(b.material));
    const needsOther = byMaterial.length > MAX_MATERIAL_SERIES;
    const named = byMaterial.slice(0, needsOther ? MAX_MATERIAL_SERIES - 1 : MAX_MATERIAL_SERIES).map((m) => m.material);
    const series = needsOther ? [...named, OTHER] : named;
    const byDate = dates.map((date) => {
      const row: Record<string, number | string> = { date };
      for (const sname of series) row[sname] = 0;
      for (const [mat, g] of cell.get(date) ?? []) {
        const key = named.includes(mat) ? mat : OTHER;
        row[key] = round((row[key] as number) + g);
      }
      return row;
    });
    consumption[kind] = {
      totalGrams: round(byMaterial.reduce((a, m) => a + m.grams, 0)),
      series,
      byDate,
      byMaterial,
      percentRows,
      missingQtyRows,
    };
  }

  return {
    days,
    from: dates[0],
    to: dates[dates.length - 1],
    dates,
    totals: {
      samples: samples.length,
      withoutDesign,
      productionSamples: productionSamples.reduce((a, d) => a + d.count, 0),
    },
    production: dates.map((date) => ({ date, count: perDate.get(date)! })),
    productionSamples,
    designs: [...designCounts.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern)),
    consumption,
  };
}

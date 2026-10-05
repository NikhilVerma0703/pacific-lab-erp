/**
 * Filtered export — the filter model and the matching logic. Pure (no
 * database), shared by the page, the Excel route and the unit tests.
 */
import type { ComponentDTO, SampleDetail } from "@/modules/samples/queries";

export type MaterialKind = "RESIN" | "GRIT" | "FILLER" | "PIGMENT";

export interface ExportFilters {
  date: string; // YYYY-MM-DD
  sampleType: "" | "CREATIVE" | "INSPIRED";
  design: "" | "PLAIN_BODY" | "NON_PLAIN_BODY";
  /** Design pattern master-value id. */
  pattern: string;
  /** Material category for the consumption filter. */
  materialKind: "" | MaterialKind;
  /** Specific material (master-value id) within the category. */
  material: string;
}

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  RESIN: "Resin",
  GRIT: "Grits",
  FILLER: "Filler",
  PIGMENT: "Pigment",
};

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Read filters from a URL query; anything invalid falls back to "any". */
export function parseFilters(q: Record<string, string | string[] | undefined>, today: string): ExportFilters {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? "";
  const pick = <T extends string>(v: string, allowed: readonly T[]): T | "" => ((allowed as readonly string[]).includes(v) ? (v as T) : "");
  return {
    date: isDate(one("date")) ? one("date") : today,
    sampleType: pick(one("type"), ["CREATIVE", "INSPIRED"] as const),
    design: pick(one("design"), ["PLAIN_BODY", "NON_PLAIN_BODY"] as const),
    pattern: one("pattern").slice(0, 40),
    materialKind: pick(one("mkind"), ["RESIN", "GRIT", "FILLER", "PIGMENT"] as const),
    material: one("material").slice(0, 40),
  };
}

export function filtersToQuery(f: ExportFilters): string {
  const p = new URLSearchParams({ date: f.date });
  if (f.sampleType) p.set("type", f.sampleType);
  if (f.design) p.set("design", f.design);
  if (f.pattern) p.set("pattern", f.pattern);
  if (f.materialKind) p.set("mkind", f.materialKind);
  if (f.material) p.set("material", f.material);
  return p.toString();
}

export interface DesignInfo {
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  patterns: { id: string; label: string }[];
  /** Where the design came from — Inspired samples carry it on their Inward entry. */
  source: "sample" | "inward" | null;
}

/** A sample's design: its own, or (Inspired) the one on its Inward / Outward entry. */
export function effectiveDesign(
  s: Pick<SampleDetail, "designCategory" | "designPatterns">,
  inward?: { designCategory: DesignInfo["designCategory"]; designPatterns: { id: string; label: string }[] } | null,
): DesignInfo {
  if (s.designCategory) return { designCategory: s.designCategory, patterns: s.designPatterns, source: "sample" };
  if (inward?.designCategory) return { designCategory: inward.designCategory, patterns: inward.designPatterns, source: "inward" };
  return { designCategory: null, patterns: [], source: null };
}

export interface Consumption {
  grams: number;
  percentEntries: number;
  /** "INEOS 1200 gm; ABC 30 %" for the matching components. */
  detail: string;
}

export function allComponents(s: Pick<SampleDetail, "formulations">): ComponentDTO[] {
  return s.formulations.flatMap((f) => f.components);
}

/** Consumption of the selected material(s) in one sample. */
export function consumptionOf(s: Pick<SampleDetail, "formulations">, kind: MaterialKind, materialId?: string): Consumption {
  const comps = allComponents(s).filter((c) => c.kind === kind && (!materialId || c.material?.id === materialId));
  let grams = 0;
  let percentEntries = 0;
  for (const c of comps) {
    if (c.quantity === null) continue;
    if (c.unit === "PERCENT") percentEntries++;
    else grams += Number(c.quantity);
  }
  return { grams: Math.round(grams * 1000) / 1000, percentEntries, detail: comps.map(componentText).join("; ") };
}

export function componentText(c: ComponentDTO): string {
  const name = c.material?.label ?? "—";
  const size = c.size ? ` (${c.size.label})` : "";
  const qty = c.quantity === null ? "" : ` ${Number(c.quantity)}${c.unit === "PERCENT" ? " %" : c.unit === "GRAMS" ? " gm" : ""}`;
  return `${name}${size}${qty}`;
}

export interface FilteredRow {
  sample: SampleDetail;
  design: DesignInfo;
  consumption: Consumption | null;
}

/** Samples of the selected date that pass every chosen filter. */
export function applyFilters(
  samples: SampleDetail[],
  inwardDesigns: Map<string, { designCategory: DesignInfo["designCategory"]; designPatterns: { id: string; label: string }[] }>,
  f: ExportFilters,
): FilteredRow[] {
  const out: FilteredRow[] = [];
  for (const s of samples) {
    if (s.sampleDate !== f.date) continue;
    if (f.sampleType && s.sampleType?.code !== f.sampleType) continue;
    const design = effectiveDesign(s, s.inwardEntry ? inwardDesigns.get(s.inwardEntry.id) : null);
    if (f.design && design.designCategory !== f.design) continue;
    if (f.pattern && !(design.designCategory === "NON_PLAIN_BODY" && design.patterns.some((p) => p.id === f.pattern))) continue;
    let consumption: Consumption | null = null;
    if (f.materialKind) {
      const uses = allComponents(s).some((c) => c.kind === f.materialKind && (!f.material || c.material?.id === f.material));
      if (!uses) continue;
      consumption = consumptionOf(s, f.materialKind, f.material || undefined);
    }
    out.push({ sample: s, design, consumption });
  }
  return out;
}

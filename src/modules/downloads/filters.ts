/**
 * Filtered export — the filter model and the matching logic. Pure (no
 * database), shared by the page, the Excel route and the unit tests.
 *
 * Sample Type covers lab samples (Creative / Inspired) and Production
 * Samples; "All sample types" includes both.
 */
import type { ComponentDTO, SampleDetail } from "@/modules/samples/queries";
import type { ProductionDetail } from "@/modules/production/queries";
import { inPeriod, parsePeriod, periodQuery, type Period } from "./period";
import { categoriesOf, unionValues, type DesignCategoryValue } from "@/modules/samples/bodies";

export type SampleTypeFilter = "" | "CREATIVE" | "INSPIRED" | "PRODUCTION";

export const SAMPLE_TYPE_OPTIONS: { value: Exclude<SampleTypeFilter, "">; label: string }[] = [
  { value: "CREATIVE", label: "Creative Sample" },
  { value: "INSPIRED", label: "Inspired Sample" },
  { value: "PRODUCTION", label: "Production Samples" },
];

export interface ExportFilters {
  /** Production Date: All / Date Wise / Date Range. */
  period: Period;
  sampleType: SampleTypeFilter;
  design: "" | "PLAIN_BODY" | "NON_PLAIN_BODY";
  /** Design pattern master-value id. */
  pattern: string;
}

/** Do these filters ask for lab samples / production samples at all? */
export const wantsLab = (f: Pick<ExportFilters, "sampleType">) => f.sampleType !== "PRODUCTION";
export const wantsProduction = (f: Pick<ExportFilters, "sampleType">) => f.sampleType === "" || f.sampleType === "PRODUCTION";

/** Read filters from a URL query; anything invalid falls back to "any". */
export function parseFilters(q: Record<string, string | string[] | undefined>, today: string): ExportFilters {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? "";
  const pick = <T extends string>(v: string, allowed: readonly T[]): T | "" => ((allowed as readonly string[]).includes(v) ? (v as T) : "");
  return {
    period: parsePeriod(q, today),
    sampleType: pick(one("type"), ["CREATIVE", "INSPIRED", "PRODUCTION"] as const),
    design: pick(one("design"), ["PLAIN_BODY", "NON_PLAIN_BODY"] as const),
    pattern: one("pattern").slice(0, 40),
  };
}

export function filtersToQuery(f: ExportFilters): string {
  const p = new URLSearchParams(periodQuery(f.period));
  if (f.sampleType) p.set("type", f.sampleType);
  if (f.design) p.set("design", f.design);
  if (f.pattern) p.set("pattern", f.pattern);
  return p.toString();
}

export interface DesignInfo {
  /** Plain and/or Non-Plain — across the record's bodies. */
  categories: DesignCategoryValue[];
  /** Every pattern of every body. */
  patterns: { id: string; label: string }[];
  /** Where the design came from — Inspired samples carry it on their Inward entry. */
  source: "sample" | "inward" | "production" | null;
}

/** A design summarised across bodies, for the filters. */
export type BodiesDesign = Pick<DesignInfo, "categories" | "patterns">;

export function designAcross(bodies: { designCategory: DesignCategoryValue | null; designPatterns: { id: string; label: string }[] }[]): BodiesDesign {
  return {
    categories: categoriesOf(bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns }))),
    patterns: unionValues(bodies.map((b) => b.designPatterns)),
  };
}

/** A sample's design across its bodies, or (Inspired) the one on its Inward / Outward entry. */
export function effectiveDesign(s: Pick<SampleDetail, "bodies">, inward?: BodiesDesign | null): DesignInfo {
  const own = designAcross(s.bodies);
  if (own.categories.length) return { ...own, source: "sample" };
  if (inward?.categories.length) return { ...inward, source: "inward" };
  return { categories: [], patterns: [], source: null };
}

/** "INEOS (Coarse) 1200 gm" — one formulation component as text. */
export function componentText(c: ComponentDTO): string {
  const name = c.material?.label ?? "—";
  const size = c.size ? ` (${c.size.label})` : "";
  // Grams by default; a value recorded in % before that option was removed keeps its "%".
  const qty = c.quantity === null ? "" : ` ${Number(c.quantity)}${c.unit === "PERCENT" ? " %" : " gm"}`;
  return `${name}${size}${qty}`;
}

/** One matching record — a lab sample or a production sample — with what the list and the Excel show. */
export type FilteredRow = {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  date: string;
  typeLabel: string | null;
  /** How many bodies the record has. */
  bodies: number;
  design: DesignInfo;
} & ({ source: "lab"; sample: SampleDetail } | { source: "production"; production: ProductionDetail });

/** Records of the selected Production Date that pass every chosen filter: lab samples first, then production samples, each by date and number. */
export function applyFilters(
  samples: SampleDetail[],
  inwardDesigns: Map<string, BodiesDesign>,
  productions: ProductionDetail[],
  f: ExportFilters,
): FilteredRow[] {
  // A record matches when any of its bodies has the chosen design / pattern.
  const designOk = (d: DesignInfo) =>
    (!f.design || d.categories.includes(f.design)) && (!f.pattern || d.patterns.some((p) => p.id === f.pattern));
  const byDateThenNo = (a: FilteredRow, b: FilteredRow) => a.date.localeCompare(b.date) || a.serialNo - b.serialNo;

  const lab: FilteredRow[] = [];
  if (wantsLab(f)) {
    for (const s of samples) {
      if (!inPeriod(s.sampleDate, f.period)) continue;
      if (f.sampleType && s.sampleType?.code !== f.sampleType) continue;
      const design = effectiveDesign(s, s.inwardEntry ? inwardDesigns.get(s.inwardEntry.id) : null);
      if (!designOk(design)) continue;
      lab.push({
        source: "lab",
        sample: s,
        id: s.id,
        serialNo: s.serialNo,
        slabNumber: s.slabNumber,
        date: s.sampleDate,
        typeLabel: s.sampleType?.label ?? null,
        bodies: s.bodies.length,
        design,
      });
    }
  }

  const production: FilteredRow[] = [];
  if (wantsProduction(f)) {
    for (const p of productions) {
      if (!inPeriod(p.sampleDate, f.period)) continue;
      const across = designAcross(p.bodies);
      const design: DesignInfo = { ...across, source: across.categories.length ? "production" : null };
      if (!designOk(design)) continue;
      production.push({
        source: "production",
        production: p,
        id: p.id,
        serialNo: p.serialNo,
        slabNumber: p.slabNumber,
        date: p.sampleDate,
        typeLabel: "Production Sample",
        bodies: p.bodies.length,
        design,
      });
    }
  }

  return [...lab.sort(byDateThenNo), ...production.sort(byDateThenNo)];
}

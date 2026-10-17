/**
 * Filtered Data Export — the filter model and the matching logic. Pure (no
 * database), shared by the page, the Excel route and the unit tests.
 *
 * Sample Type picks one form — Lab Sample, Sample Inward / Outward or
 * Production Sample. Sample Design narrows to one Design Name and Design Type
 * to one design type ("Plain Body", "Roy Body" …); every chosen filter must match.
 */
import { cleanLabel, normalizeKey } from "@/lib/normalize";
import { designTypeTags } from "@/modules/forms/design-types";
import { inwardDesignOf } from "@/modules/inward-outward/design-text";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { ProductionDetail } from "@/modules/production/queries";
import type { ComponentDTO, SampleDetail } from "@/modules/samples/queries";
import { inPeriod, parsePeriod, periodQuery, type Period } from "./period";

export const SAMPLE_TYPES = ["LAB", "INWARD", "PRODUCTION"] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];

/** The three reports — the same names in Sample Data Download and in Sample Type. */
export const SAMPLE_TYPE_OPTIONS: { value: SampleType; label: string; record: string; permission: "sample.view" | "inward.view" | "production.view" }[] = [
  { value: "LAB", label: "Lab Sample Reports", record: "Lab Sample", permission: "sample.view" },
  { value: "INWARD", label: "Sample Inward/Outward Reports", record: "Inward / Outward Sample", permission: "inward.view" },
  { value: "PRODUCTION", label: "Production Sample Reports", record: "Production Sample", permission: "production.view" },
];

export const sampleTypeOption = (t: SampleType) => SAMPLE_TYPE_OPTIONS.find((o) => o.value === t)!;

export interface ExportFilters {
  /** Production Date: All / Date Wise / Date Range. */
  period: Period;
  sampleType: SampleType;
  /** Sample Design — a Design Name; "" = all. */
  sampleDesign: string;
  /** Design Type — "Plain Body", "Roy Body" …; "" = all. */
  designType: string;
}

/** Read filters from a URL query; anything invalid falls back to the default. */
export function parseFilters(q: Record<string, string | string[] | undefined>, today: string): ExportFilters {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? "";
  const type = one("type");
  return {
    period: parsePeriod(q, today),
    // Lab Sample Reports unless another report is asked for (older links' "all types" included).
    sampleType: (SAMPLE_TYPES as readonly string[]).includes(type) ? (type as SampleType) : "LAB",
    sampleDesign: cleanLabel(one("sdesign")).slice(0, 120),
    designType: cleanLabel(one("dtype")).slice(0, 120),
  };
}

export function filtersToQuery(f: ExportFilters): string {
  const p = new URLSearchParams(periodQuery(f.period));
  p.set("type", f.sampleType);
  if (f.sampleDesign) p.set("sdesign", f.sampleDesign);
  if (f.designType) p.set("dtype", f.designType);
  return p.toString();
}

/** What the page and the Excel say about the chosen filters. */
export function filterLabels(f: ExportFilters) {
  return {
    sampleType: sampleTypeOption(f.sampleType).label,
    sampleDesign: f.sampleDesign || "All sample designs",
    designType: f.designType || "All design types",
  };
}

// ── what each form records ───────────────────────────────────────────────────

/** A lab sample's Design Types (earlier-form samples body by body). */
export const labDesignTypes = (s: SampleDetail): string[] =>
  designTypeTags({ plainBody: s.plainBody, types: s.designTypes.map((t) => t.type), bodies: s.bodies, otherPatterns: s.otherPatterns });

/** An Inward / Outward entry's Design Types (earlier-form entries body by body). */
export function inwardDesignTypes(e: InwardDetail): string[] {
  const { plainBody, types } = inwardDesignOf(e);
  // A rebuilt-form entry repeats the sample's design on every body; the earlier form's other patterns ride along.
  return designTypeTags({ plainBody, types, bodies: e.legacyBodies ? e.bodies : [], otherPatterns: e.legacyBodies ? [] : (e.bodies[0]?.designPatterns ?? []) });
}

/** A production sample's Design Types — only entries of the earlier form recorded a design. */
export const productionDesignTypes = (p: ProductionDetail): string[] => designTypeTags({ plainBody: null, types: [], bodies: p.bodies });

/** "INEOS (Coarse) 1200 gm" — one material as text. */
export function componentText(c: ComponentDTO): string {
  const name = c.material?.label ?? "—";
  const size = c.size ? ` (${c.size.label})` : "";
  // Grams by default; a value recorded in % before that option was removed keeps its "%".
  const qty = c.quantity === null ? "" : ` ${Number(c.quantity)}${c.unit === "PERCENT" ? " %" : " gm"}`;
  return `${name}${size}${qty}`;
}

/** One matching record with what the list and the Excel show. */
export type FilteredRow = {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  date: string;
  designName: string | null;
  designTypes: string[];
  numberOfBodies: number | null;
} & ({ source: "LAB"; sample: SampleDetail } | { source: "INWARD"; inward: InwardDetail } | { source: "PRODUCTION"; production: ProductionDetail });

/** The records of the selected type, with each one's Design Name and Design Types. */
export type FilterSource = { type: "LAB"; samples: SampleDetail[] } | { type: "INWARD"; entries: InwardDetail[] } | { type: "PRODUCTION"; productions: ProductionDetail[] };

export function toRows(src: FilterSource): FilteredRow[] {
  switch (src.type) {
    case "LAB":
      return src.samples.map((s) => ({
        source: "LAB",
        sample: s,
        id: s.id,
        serialNo: s.serialNo,
        slabNumber: s.slabNumber,
        date: s.sampleDate,
        designName: s.designName,
        designTypes: labDesignTypes(s),
        numberOfBodies: s.numberOfBodies ?? (s.bodies.length || null),
      }));
    case "INWARD":
      return src.entries.map((e) => ({
        source: "INWARD",
        inward: e,
        id: e.id,
        serialNo: e.serialNo,
        slabNumber: e.slabNumber,
        date: e.entryDate,
        designName: e.sampleDesignName,
        designTypes: inwardDesignTypes(e),
        numberOfBodies: e.numberOfBodies ?? (e.bodies.length || null),
      }));
    case "PRODUCTION":
      return src.productions.map((p) => ({
        source: "PRODUCTION",
        production: p,
        id: p.id,
        serialNo: p.serialNo,
        slabNumber: p.slabNumber,
        date: p.sampleDate,
        designName: p.designName,
        designTypes: productionDesignTypes(p),
        numberOfBodies: p.numberOfBodies ?? (p.bodies.length || null),
      }));
  }
}

/**
 * Records of the selected Sample Type and Production Date that match the
 * chosen Sample Design and Design Type (names compared ignoring case and
 * spaces; a record with several design types matches each of them), oldest
 * date first, then by S.No.
 */
export function applyFilters(src: FilterSource, f: ExportFilters): FilteredRow[] {
  if (src.type !== f.sampleType) return [];
  const design = normalizeKey(f.sampleDesign);
  const type = normalizeKey(f.designType);
  return toRows(src)
    .filter(
      (r) =>
        inPeriod(r.date, f.period) &&
        (!design || normalizeKey(r.designName ?? "") === design) &&
        (!type || r.designTypes.some((t) => normalizeKey(t) === type)),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.serialNo - b.serialNo);
}

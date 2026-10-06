import { describe, expect, it } from "vitest";
import { applyFilters, consumptionOf, parseFilters, type ExportFilters } from "@/modules/downloads/filters";
import type { SampleDetail } from "@/modules/samples/queries";

const v = (id: string, label: string, code: string | null = null) => ({ id, label, code, isActive: true });
const sample = (over: Partial<SampleDetail>): SampleDetail => ({
  id: "s", serialNo: 1, slabNumber: 1, sampleDate: "2026-10-05", status: "SUBMITTED",
  sampleType: v("t1", "Creative Sample", "CREATIVE"), designName: null, physicalSamplePresent: null, inwardEntry: null,
  numberOfBodies: null, designCategory: null, designPatterns: [], mixerType: null, hasVein: null,
  veinMethods: [], veinNotes: null, remarks: null, formulations: [], measurements: [], attachments: [],
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});
const fm = (role: "MAIN_BODY" | "DESIGN_ROY_BODY", components: SampleDetail["formulations"][number]["components"], veinRoy: SampleDetail["formulations"][number]["components"] = []) => ({
  role, components, numberOfBodies: null, hasVein: null, veinNotes: null, mixerType: null, veinMethods: [], measurements: [],
  veinRoyBody: veinRoy.length ? { components: veinRoy } : null,
});
const base: ExportFilters = { date: "2026-10-05", sampleType: "", design: "", pattern: "", materialKind: "", material: "" };

const s1 = sample({
  id: "a", designCategory: "NON_PLAIN_BODY", designPatterns: [v("p1", "CARRARA"), v("p2", "ROY BODY", "ROY_BODY")],
  formulations: [
    fm("MAIN_BODY", [
      { kind: "RESIN", material: v("r1", "INEOS"), size: null, unit: "GRAMS", quantity: "1200" },
      { kind: "RESIN", material: v("r2", "ABC"), size: null, unit: "PERCENT", quantity: "30" },
    ]),
    fm("DESIGN_ROY_BODY", [{ kind: "RESIN", material: v("r1", "INEOS"), size: null, unit: "GRAMS", quantity: "300" }],
      [{ kind: "RESIN", material: v("r1", "INEOS"), size: null, unit: "GRAMS", quantity: "50" }]),
  ],
});
const s2 = sample({ id: "b", sampleType: v("t2", "Inspired Sample", "INSPIRED"), inwardEntry: { id: "e1", serialNo: 1 } });
const s3 = sample({ id: "c", sampleDate: "2026-10-04", designCategory: "PLAIN_BODY" });
const inward = new Map([["e1", { designCategory: "PLAIN_BODY" as const, designPatterns: [] }]]);

describe("filtered export", () => {
  it("keeps only the selected date", () => {
    expect(applyFilters([s1, s2, s3], inward, base).map((r) => r.sample.id)).toEqual(["a", "b"]);
  });
  it("filters by type, design (incl. Inspired design from Inward) and pattern", () => {
    expect(applyFilters([s1, s2], inward, { ...base, sampleType: "INSPIRED" }).map((r) => r.sample.id)).toEqual(["b"]);
    expect(applyFilters([s1, s2], inward, { ...base, design: "PLAIN_BODY" }).map((r) => r.sample.id)).toEqual(["b"]);
    expect(applyFilters([s1, s2], inward, { ...base, pattern: "p2" }).map((r) => r.sample.id)).toEqual(["a"]);
  });
  it("material filter keeps users of the material and sums grams across formulations", () => {
    const rows = applyFilters([s1, s2], inward, { ...base, materialKind: "RESIN", material: "r1" });
    expect(rows.map((r) => r.sample.id)).toEqual(["a"]);
    expect(rows[0].consumption?.grams).toBe(1550); // main + Roy Body + the Roy Body's own vein Roy Body
    expect(consumptionOf(s1, "RESIN")).toMatchObject({ grams: 1550, percentEntries: 1 });
  });
  it("parses URL filters safely", () => {
    expect(parseFilters({ date: "bad", type: "X", mkind: "RESIN" }, "2026-10-05")).toEqual({ ...base, materialKind: "RESIN" });
  });
});

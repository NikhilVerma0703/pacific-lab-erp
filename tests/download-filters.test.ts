import { describe, expect, it } from "vitest";
import { applyFilters, parseFilters, type ExportFilters } from "@/modules/downloads/filters";
import type { ProductionDetail } from "@/modules/production/queries";
import type { SampleDetail } from "@/modules/samples/queries";

const v = (id: string, label: string, code: string | null = null) => ({ id, label, code, isActive: true });
type Body = SampleDetail["bodies"][number];
const body = (index: number, over: Partial<Body> = {}): Body => ({
  index, main: null, designCategory: null, designPatterns: [], designRoyBody: null, mixerType: null, hasVein: null,
  veinMethods: [], veinNotes: null, veinRoyBody: null, postPress: null, postPolish: null, ...over,
});
const sample = (over: Partial<SampleDetail>): SampleDetail => ({
  id: "s", serialNo: 1, slabNumber: 1, sampleDate: "2026-10-05", status: "SUBMITTED",
  designName: null, designNameRef: null, physicalSamplePresent: null, inwardEntry: null,
  numberOfBodies: null, bodies: [], legacyBodies: false, remarks: null, attachments: [],
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});
const day = { mode: "date" as const, date: "2026-10-05", from: "2026-09-29", to: "2026-10-05" };
const base: ExportFilters = { period: day, sampleType: "", design: "", pattern: "" };

// Body 1 Plain, Body 2 Non-Plain with CARRARA + ROY BODY.
const s1 = sample({
  id: "a",
  numberOfBodies: 2,
  bodies: [body(1, { designCategory: "PLAIN_BODY" }), body(2, { designCategory: "NON_PLAIN_BODY", designPatterns: [v("p1", "CARRARA"), v("p2", "ROY BODY", "ROY_BODY")] })],
});
// No design of its own — its Inward / Outward entry's design (Plain) is used.
const s2 = sample({ id: "b", inwardEntry: { id: "e1", serialNo: 1 } });
const s3 = sample({ id: "c", sampleDate: "2026-10-04", numberOfBodies: 1, bodies: [body(1, { designCategory: "PLAIN_BODY" })] });
const inward = new Map([["e1", { categories: ["PLAIN_BODY" as const], patterns: [] }]]);

type PBody = ProductionDetail["bodies"][number];
const pbody = (index: number, over: Partial<PBody> = {}): PBody => ({
  index, designCategory: null, designPatterns: [], royBody: null, postPress: null, postPolish: null, ...over,
});
const prod = (over: Partial<ProductionDetail>): ProductionDetail => ({
  id: "p", serialNo: 1, slabNumber: 1, sampleDate: "2026-10-05", designName: null, designNameRef: null, numberOfBodies: null,
  bodies: [], legacyBodies: false, attachments: [], remarks: null,
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});
const p1 = prod({ id: "x", numberOfBodies: 1, bodies: [pbody(1, { designCategory: "NON_PLAIN_BODY", designPatterns: [v("p2", "ROY BODY", "ROY_BODY")] })] });
const p2 = prod({ id: "y", serialNo: 2, numberOfBodies: 1, bodies: [pbody(1, { designCategory: "PLAIN_BODY" })] });
const p3 = prod({ id: "z", serialNo: 3, sampleDate: "2026-10-01" });
const ids = (rows: ReturnType<typeof applyFilters>) => rows.map((r) => `${r.source}:${r.id}`);

describe("filtered export", () => {
  it("keeps only the selected date; All sample types includes production samples", () => {
    expect(ids(applyFilters([s1, s2, s3], inward, [p1, p2, p3], base))).toEqual(["lab:a", "lab:b", "production:x", "production:y"]);
  });
  it("filters by type, design (incl. the design from the Inward entry) and pattern", () => {
    expect(ids(applyFilters([s1, s2], inward, [p1], { ...base, sampleType: "LAB" }))).toEqual(["lab:a", "lab:b"]);
    expect(applyFilters([s1], inward, [], base)[0]).toMatchObject({ typeLabel: "Lab Sample", bodies: 2 });
    expect(applyFilters([s2], inward, [], base)[0].design).toMatchObject({ categories: ["PLAIN_BODY"], source: "inward" });
    // s1 matches Plain (Body 1) and Non-Plain (Body 2): any body counts.
    expect(ids(applyFilters([s1, s2], inward, [p1, p2], { ...base, design: "PLAIN_BODY" }))).toEqual(["lab:a", "lab:b", "production:y"]);
    expect(ids(applyFilters([s1, s2], inward, [p1, p2], { ...base, design: "NON_PLAIN_BODY" }))).toEqual(["lab:a", "production:x"]);
    expect(ids(applyFilters([s1, s2], inward, [p1, p2], { ...base, pattern: "p2" }))).toEqual(["lab:a", "production:x"]);
  });
  it("Production Samples shows production samples only, with the other filters", () => {
    const f = { ...base, sampleType: "PRODUCTION" as const };
    expect(ids(applyFilters([s1, s2], inward, [p1, p2, p3], f))).toEqual(["production:x", "production:y"]);
    expect(ids(applyFilters([s1], inward, [p1, p2], { ...f, design: "NON_PLAIN_BODY" }))).toEqual(["production:x"]);
    expect(applyFilters([s1], inward, [p2], f)[0]).toMatchObject({ typeLabel: "Production Sample", bodies: 1, design: { categories: ["PLAIN_BODY"], source: "production" } });
  });
  it("parses URL filters safely (old material filters are ignored)", () => {
    expect(parseFilters({ date: "bad", type: "X", mkind: "RESIN", material: "r1" }, "2026-10-05")).toEqual(base);
    expect(parseFilters({ date: "2026-10-05", type: "PRODUCTION" }, "2026-10-05").sampleType).toBe("PRODUCTION");
    expect(parseFilters({ date: "2026-10-05", type: "LAB" }, "2026-10-05").sampleType).toBe("LAB");
    // Links saved while Sample Type existed (Creative / Inspired) now mean all sample types.
    expect(parseFilters({ date: "2026-10-05", type: "INSPIRED" }, "2026-10-05").sampleType).toBe("");
    expect(parseFilters({ date: "2026-10-05", type: "CREATIVE" }, "2026-10-05").sampleType).toBe("");
  });
  it("follows the Production Date: All and Date Range", () => {
    const all = { mode: "all" as const, date: "2026-10-05", from: "", to: "2026-10-05" };
    expect(ids(applyFilters([s1, s2, s3], inward, [p1, p3], { ...base, period: all }))).toEqual(["lab:c", "lab:a", "lab:b", "production:z", "production:x"]);
    const range = { mode: "range" as const, date: "2026-10-04", from: "2026-10-01", to: "2026-10-04" };
    expect(ids(applyFilters([s1, s2, s3], inward, [p1, p3], { ...base, period: range }))).toEqual(["lab:c", "production:z"]);
  });
});

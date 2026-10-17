import { describe, expect, it } from "vitest";
import { designTypeTags } from "@/modules/forms/design-types";
import {
  applyFilters,
  filterLabels,
  filtersToQuery,
  inwardDesignTypes,
  labDesignTypes,
  parseFilters,
  productionDesignTypes,
  type ExportFilters,
} from "@/modules/downloads/filters";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { ProductionDetail } from "@/modules/production/queries";
import type { SampleDetail } from "@/modules/samples/queries";

const v = (id: string, label: string, code: string | null = null) => ({ id, label, code, isActive: true });
const t = (type: SampleDetail["designTypes"][number]["type"]) => ({ type, bodyCount: null, veinPresent: null, mixerType: null, veinDetails: [], colours: [] });

type Body = SampleDetail["bodies"][number];
const body = (index: number, over: Partial<Body> = {}): Body => ({
  index, main: null, designCategory: null, designPatterns: [], designRoyBody: null, mixerType: null, hasVein: null,
  veinMethods: [], veinDetails: [], veinNotes: null, veinRoyBody: null, postPress: null, postPolish: null, ...over,
});
const sample = (over: Partial<SampleDetail>): SampleDetail => ({
  id: "s", serialNo: 1, slabNumber: 1, sampleDate: "2026-10-05", status: "SUBMITTED",
  designName: null, designNameRef: null, physicalSamplePresent: null, inwardEntry: null,
  numberOfBodies: null, plainBody: null, designTypes: [], otherPatterns: [], bodies: [], royBodies: [], chessboardBodies: [],
  legacyBodies: false, remarks: null, attachments: [],
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});
const entry = (over: Partial<InwardDetail>): InwardDetail => ({
  id: "e", serialNo: 1, entryDate: "2026-10-05", slabNumber: null, labSample: null, company: null,
  sampleDesignName: null, sampleDesignNameRef: null, plainBody: null, designTypes: [], numberOfBodies: null,
  bodies: [], royBodies: [], chessboardBodies: [], legacyBodies: false, recreationAttempts: null, attachments: [], remarks: null,
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});
type PBody = ProductionDetail["bodies"][number];
const pbody = (index: number, over: Partial<PBody> = {}): PBody => ({
  index, designCategory: null, designPatterns: [], royBody: null, postPress: null, postPolish: null, ...over,
});
const prod = (over: Partial<ProductionDetail>): ProductionDetail => ({
  id: "p", serialNo: 1, slabNumber: 1, sampleDate: "2026-10-05", designName: null, designNameRef: null, numberOfBodies: null,
  bodies: [], legacyBodies: false, attachments: [], remarks: null,
  createdBy: null, updatedBy: null, createdAt: "", updatedAt: "", ...over,
});

const day = { mode: "date" as const, date: "2026-10-05", from: "2026-09-29", to: "2026-10-05" };
const base: ExportFilters = { period: day, sampleType: "LAB", sampleDesign: "", designType: "" };

// Lab samples of the rebuilt form …
const s1 = sample({ id: "a", serialNo: 2, designName: "Statuario Gold", numberOfBodies: 2, plainBody: false, designTypes: [t("ROY_BODY"), t("CARRARA")] });
const s2 = sample({ id: "b", serialNo: 1, designName: "statuario  gold", numberOfBodies: 1, plainBody: true });
const s3 = sample({ id: "c", sampleDate: "2026-10-04", designName: "Onyx", plainBody: false, designTypes: [t("KREOS")] });
// … and of the earlier form: Body 1 Plain, Body 2 Non-Plain with CARRARA + an older pattern.
const s4 = sample({
  id: "d", serialNo: 3, designName: "Old One", plainBody: false, designTypes: [t("CARRARA")], otherPatterns: [v("p9", "Calacatta")],
  bodies: [body(1, { designCategory: "PLAIN_BODY" }), body(2, { designCategory: "NON_PLAIN_BODY", designPatterns: [v("p1", "CARRARA"), v("p9", "Calacatta")] })],
});
const lab = (samples: SampleDetail[]) => ({ type: "LAB" as const, samples });
const ids = (rows: ReturnType<typeof applyFilters>) => rows.map((r) => r.id);

describe("filtered export", () => {
  it("Design Types of each form, earlier forms read body by body", () => {
    expect(labDesignTypes(s1)).toEqual(["Roy Body", "Carrara"]);
    expect(labDesignTypes(s2)).toEqual(["Plain Body"]);
    expect(labDesignTypes(s4)).toEqual(["Plain Body", "Carrara", "Calacatta"]);
    expect(inwardDesignTypes(entry({ plainBody: false, designTypes: [t("CHESSBOARD"), t("VEIN")] }))).toEqual(["Vein", "Chessboard"]);
    expect(
      inwardDesignTypes(
        entry({ legacyBodies: true, bodies: [{ index: 1, designCategory: "NON_PLAIN_BODY", designPatterns: [v("r", "ROY BODY", "ROY_BODY")], royBody: null, lab: null }] }),
      ),
    ).toEqual(["Roy Body"]);
    expect(productionDesignTypes(prod({ bodies: [pbody(1, { designCategory: "NON_PLAIN_BODY", designPatterns: [v("k", "Kreos")] })] }))).toEqual(["Kreos"]);
    expect(productionDesignTypes(prod({ bodies: [pbody(1)] }))).toEqual([]);
    expect(designTypeTags({ plainBody: false, types: [] })).toEqual([]);
  });

  it("keeps only the selected date, oldest first then by S.No.", () => {
    expect(ids(applyFilters(lab([s1, s2, s3, s4]), base))).toEqual(["b", "a", "d"]);
    const range = { mode: "range" as const, date: "2026-10-05", from: "2026-10-01", to: "2026-10-05" };
    expect(ids(applyFilters(lab([s1, s2, s3]), { ...base, period: range }))).toEqual(["c", "b", "a"]);
  });

  it("Sample Design matches the Design Name ignoring case and spaces", () => {
    expect(ids(applyFilters(lab([s1, s2, s3, s4]), { ...base, sampleDesign: "STATUARIO GOLD" }))).toEqual(["b", "a"]);
    expect(applyFilters(lab([s1, s2]), { ...base, sampleDesign: "Nothing" })).toEqual([]);
  });

  it("Design Type matches any of a record's types; filters combine", () => {
    expect(ids(applyFilters(lab([s1, s2, s4]), { ...base, designType: "Carrara" }))).toEqual(["a", "d"]);
    expect(ids(applyFilters(lab([s1, s2, s4]), { ...base, designType: "plain body" }))).toEqual(["b", "d"]);
    expect(ids(applyFilters(lab([s1, s2, s4]), { ...base, designType: "Calacatta" }))).toEqual(["d"]);
    expect(ids(applyFilters(lab([s1, s2, s4]), { ...base, designType: "Carrara", sampleDesign: "Statuario Gold" }))).toEqual(["a"]);
  });

  it("works on each Sample Type", () => {
    const e1 = entry({ id: "x", sampleDesignName: "Onyx", plainBody: true, numberOfBodies: 2 });
    const e2 = entry({ id: "y", serialNo: 2, sampleDesignName: "Onyx", plainBody: false, designTypes: [t("VEIN")] });
    const inward = { type: "INWARD" as const, entries: [e1, e2] };
    expect(applyFilters(inward, base)).toEqual([]); // records of another type never match
    const f = { ...base, sampleType: "INWARD" as const, sampleDesign: "onyx" };
    expect(ids(applyFilters(inward, f))).toEqual(["x", "y"]);
    expect(applyFilters(inward, { ...f, designType: "Vein" })[0]).toMatchObject({ id: "y", source: "INWARD", designName: "Onyx", designTypes: ["Vein"] });
    expect(applyFilters(inward, f)[0]).toMatchObject({ numberOfBodies: 2 });

    const p1 = prod({ id: "m", designName: "Onyx", numberOfBodies: 3 });
    const p2 = prod({ id: "n", serialNo: 2, designName: "Marquina", bodies: [pbody(1, { designCategory: "PLAIN_BODY" })] });
    const production = { type: "PRODUCTION" as const, productions: [p1, p2] };
    const pf = { ...base, sampleType: "PRODUCTION" as const };
    expect(ids(applyFilters(production, pf))).toEqual(["m", "n"]);
    expect(ids(applyFilters(production, { ...pf, sampleDesign: "Onyx" }))).toEqual(["m"]);
    expect(ids(applyFilters(production, { ...pf, designType: "Plain Body" }))).toEqual(["n"]);
  });

  it("parses URL filters safely", () => {
    expect(parseFilters({ date: "bad", type: "X", design: "PLAIN_BODY", pattern: "p1" }, "2026-10-05")).toEqual(base);
    expect(parseFilters({ date: "2026-10-05" }, "2026-10-05").sampleType).toBe("LAB");
    expect(parseFilters({ date: "2026-10-05", type: "INWARD" }, "2026-10-05").sampleType).toBe("INWARD");
    expect(parseFilters({ date: "2026-10-05", type: "PRODUCTION", sdesign: "  Onyx   Flow ", dtype: "Roy Body" }, "2026-10-05")).toMatchObject({
      sampleType: "PRODUCTION",
      sampleDesign: "Onyx Flow",
      designType: "Roy Body",
    });
    const f: ExportFilters = { ...base, sampleType: "INWARD", sampleDesign: "Onyx & Co", designType: "Plain Body" };
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))), "2026-10-05")).toEqual(f);
    expect(filterLabels(base)).toEqual({ sampleType: "Lab Sample Reports", sampleDesign: "All sample designs", designType: "All design types" });
  });
});

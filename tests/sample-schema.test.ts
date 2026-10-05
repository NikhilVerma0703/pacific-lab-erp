import { describe, expect, it } from "vitest";
import { newSampleInput, sampleFormSchema } from "@/modules/samples/schema";

const base = () => newSampleInput({ serialNo: 22, slabNumber: 4468, today: "2026-10-05" });

describe("sample form schema", () => {
  it("accepts a completely blank form (nothing is mandatory)", () => {
    const r = sampleFormSchema.safeParse({ ...base(), serialNo: "", slabNumber: "", sampleDate: "" });
    expect(r.success).toBe(true);
  });

  it("turns typed strings into numbers", () => {
    const r = sampleFormSchema.parse({ ...base(), numberOfBodies: "2", postPress: [{ l: "82.5", a: "-0.4", b: "" }, { l: "", a: "", b: "" }], postPolish: [] });
    expect(r.serialNo).toBe(22);
    expect(r.numberOfBodies).toBe(2);
    expect(r.postPress[0]).toEqual({ l: 82.5, a: -0.4, b: null });
  });

  it("rejects non-numeric quantities and out-of-range values", () => {
    const f = base();
    f.main.resins[0].quantity = "12kg";
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
    const g = base();
    g.numberOfBodies = "1.5";
    expect(sampleFormSchema.safeParse(g).success).toBe(false);
    const h = { ...base(), numberOfBodies: "1", postPress: [{ l: "120", a: "", b: "" }] };
    expect(sampleFormSchema.safeParse(h).success).toBe(false);
  });

  it("caps percentages at 100", () => {
    const f = base();
    f.main.fillers[0] = { material: null, size: null, unit: "PERCENT", quantity: "120" };
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
  });

  it("rejects the same pattern picked twice", () => {
    const f = { ...base(), designCategory: "NON_PLAIN_BODY" as const, designPatterns: [{ id: "a", label: "CARRARA" }, { id: "a", label: "CARRARA" }] };
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
  });
});

describe("physical sample present", () => {
  it("maps Yes / No / blank", () => {
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "YES" }).physicalSamplePresent).toBe(true);
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "NO" }).physicalSamplePresent).toBe(false);
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "" }).physicalSamplePresent).toBe(null);
  });
});

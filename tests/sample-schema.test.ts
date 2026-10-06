import { describe, expect, it } from "vitest";
import { emptySampleBody, newSampleInput, sampleFormSchema } from "@/modules/samples/schema";

const base = () => newSampleInput({ serialNo: 22, slabNumber: 4468, today: "2026-10-05" });
const withBodies = (n: number) => ({ ...base(), numberOfBodies: String(n), bodies: Array.from({ length: n }, emptySampleBody) });

describe("sample form schema", () => {
  it("accepts a completely blank form (nothing is mandatory)", () => {
    const r = sampleFormSchema.safeParse({ ...base(), serialNo: "", slabNumber: "", sampleDate: "" });
    expect(r.success).toBe(true);
  });

  it("keeps every body on its own and turns typed strings into numbers", () => {
    const f = withBodies(2);
    f.bodies[0].postPress = { l: "82.5", a: "-0.4", b: "" };
    f.bodies[1].postPolish = { l: "79", a: "0.2", b: "1.5" };
    f.bodies[1].designCategory = "PLAIN_BODY";
    f.bodies[0].main.resins[0].quantity = "1200";
    const r = sampleFormSchema.parse(f);
    expect(r.serialNo).toBe(22);
    expect(r.numberOfBodies).toBe(2);
    expect(r.bodies).toHaveLength(2);
    expect(r.bodies[0].postPress).toEqual({ l: 82.5, a: -0.4, b: null });
    expect(r.bodies[1].postPolish).toEqual({ l: 79, a: 0.2, b: 1.5 });
    expect(r.bodies[0].designCategory).toBeNull();
    expect(r.bodies[1].designCategory).toBe("PLAIN_BODY");
    expect(r.bodies[0].main.resins[0].quantity).toBe(1200);
  });

  it("rejects non-numeric quantities, bad n and out-of-range L/a/b — on the right body", () => {
    const f = withBodies(2);
    f.bodies[1].main.resins[0].quantity = "12kg";
    const r = sampleFormSchema.safeParse(f);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual(["bodies.1.main.resins.0.quantity"]);
    expect(sampleFormSchema.safeParse({ ...base(), numberOfBodies: "1.5" }).success).toBe(false);
    const h = withBodies(1);
    h.bodies[0].postPress = { l: "120", a: "", b: "" };
    expect(sampleFormSchema.safeParse(h).success).toBe(false);
  });

  it("rejects more body sections than bodies", () => {
    const f = { ...withBodies(2), numberOfBodies: "1" };
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
  });

  it("caps percentages at 100", () => {
    const f = withBodies(1);
    f.bodies[0].main.fillers[0] = { material: null, size: null, unit: "PERCENT", quantity: "120" };
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
  });

  it("rejects the same pattern or vein method picked twice in a body", () => {
    const f = withBodies(1);
    f.bodies[0].designCategory = "NON_PLAIN_BODY";
    f.bodies[0].designPatterns = [{ id: "a", label: "CARRARA" }, { id: "a", label: "CARRARA" }];
    expect(sampleFormSchema.safeParse(f).success).toBe(false);
    const g = withBodies(1);
    g.bodies[0].veinMethods = [{ id: "m", label: "KREOS" }, { id: "m", label: "KREOS" }];
    expect(sampleFormSchema.safeParse(g).success).toBe(false);
  });
});

describe("physical sample present", () => {
  it("maps Yes / No / blank", () => {
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "YES" }).physicalSamplePresent).toBe(true);
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "NO" }).physicalSamplePresent).toBe(false);
    expect(sampleFormSchema.parse({ ...base(), physicalSamplePresent: "" }).physicalSamplePresent).toBe(null);
  });
});

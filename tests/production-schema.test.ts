import { describe, expect, it } from "vitest";
import { emptyProductionBody, newProductionInput, productionFormSchema } from "@/modules/production/schema";

const blank = () => newProductionInput({ serialNo: 7, slabNumber: 120, today: "2026-10-06" });

describe("production sample form schema", () => {
  it("accepts a blank entry (nothing is mandatory)", () => {
    const r = productionFormSchema.parse(blank());
    expect(r.serialNo).toBe(7);
    expect(r.slabNumber).toBe(120);
    expect(r.designName).toBeNull();
    expect(r.numberOfBodies).toBeNull();
    expect(r.bodies).toEqual([]);
  });

  it("parses each body's readings and its Roy Body", () => {
    const r = productionFormSchema.parse({
      ...blank(),
      designName: { id: "dn1", label: "Calacatta Gold" },
      numberOfBodies: "2",
      bodies: [
        {
          ...emptyProductionBody(),
          designCategory: "NON_PLAIN_BODY",
          designPatterns: [{ id: "p1", label: "Roy Body" }],
          designRoyBody: { numberOfBodies: "1", postPress: [{ l: "80", a: "0.2", b: "1.9" }], postPolish: [{ l: "", a: "", b: "" }] },
          postPress: { l: "72.5", a: "-0.3", b: "2" },
          postPolish: { l: "71", a: "0", b: "2.1" },
        },
        { ...emptyProductionBody(), designCategory: "PLAIN_BODY", postPolish: { l: "70", a: "0.1", b: "2.2" } },
      ],
      remarks: "  Slight shade variation  ",
    });
    expect(r.designName).toEqual({ id: "dn1", label: "Calacatta Gold" });
    expect(r.bodies[0].postPress).toEqual({ l: 72.5, a: -0.3, b: 2 });
    expect(r.bodies[1].postPress).toEqual({ l: null, a: null, b: null });
    expect(r.bodies[1].postPolish).toEqual({ l: 70, a: 0.1, b: 2.2 });
    expect(r.bodies[0].designRoyBody.numberOfBodies).toBe(1);
    expect(r.bodies[0].designRoyBody.postPress[0].l).toBe(80);
    expect(r.remarks).toBe("Slight shade variation");
  });

  it("rejects out-of-range values and more body sections than bodies", () => {
    const range = productionFormSchema.safeParse({ ...blank(), numberOfBodies: "1", bodies: [{ ...emptyProductionBody(), postPress: { l: "120", a: "", b: "" } }] });
    expect(range.success ? [] : range.error.issues.map((i) => i.path.join("."))).toEqual(["bodies.0.postPress.l"]);
    const extra = productionFormSchema.safeParse({ ...blank(), numberOfBodies: "1", bodies: [emptyProductionBody(), emptyProductionBody()] });
    expect(extra.success ? [] : extra.error.issues.map((i) => i.path.join("."))).toEqual(["numberOfBodies"]);
    expect(productionFormSchema.safeParse({ ...blank(), numberOfBodies: "0" }).success).toBe(false);
    expect(productionFormSchema.safeParse({ ...blank(), slabNumber: "12.5" }).success).toBe(false);
  });

  it("flags a pattern picked twice in a body", () => {
    const r = productionFormSchema.safeParse({
      ...blank(),
      numberOfBodies: "1",
      bodies: [{ ...emptyProductionBody(), designCategory: "NON_PLAIN_BODY", designPatterns: [{ id: "p1", label: "Roy Body" }, { id: "p1", label: "Roy Body" }] }],
    });
    expect(r.success).toBe(false);
  });
});

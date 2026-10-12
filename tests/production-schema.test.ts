import { describe, expect, it } from "vitest";
import { bodyCount, emptyBodyReadings, fieldErrorsOf } from "@/modules/forms/fields";
import { newProductionInput, productionFormSchema, visibleProductionInput } from "@/modules/production/schema";

const blank = () => newProductionInput({ serialNo: 7, slabNumber: 120, today: "2026-10-12" });
const reading = (l: string, a: string, b: string) => ({ l, a, b });

describe("Production Sample form", () => {
  it("has exactly the five Basic Information fields, the bodies, files and remarks", () => {
    expect(Object.keys(blank()).sort()).toEqual(
      ["attachmentIds", "bodies", "designName", "numberOfBodies", "remarks", "sampleDate", "serialNo", "slabNumber"].sort(),
    );
  });

  it("accepts a blank entry (nothing is mandatory)", () => {
    const r = productionFormSchema.parse(blank());
    expect(r).toMatchObject({ serialNo: 7, slabNumber: 120, sampleDate: "2026-10-12", designName: null, numberOfBodies: null, bodies: [], remarks: null });
  });

  it("N = 2 → Body 1 and Body 2, each Post Press and Post Polish L, a, b", () => {
    const r = productionFormSchema.parse({
      ...blank(),
      designName: { id: "dn1", label: "Calacatta Gold" },
      numberOfBodies: "2",
      bodies: [
        { postPress: reading("72.5", "-0.3", "2"), postPolish: reading("71", "0", "2.1") },
        { postPress: reading("", "", ""), postPolish: reading("70", "0.1", "2.2") },
      ],
      remarks: "  Slight shade variation  ",
    });
    expect(r.designName).toEqual({ id: "dn1", label: "Calacatta Gold" });
    expect(r.numberOfBodies).toBe(2);
    expect(r.bodies[0]).toEqual({ postPress: { l: 72.5, a: -0.3, b: 2 }, postPolish: { l: 71, a: 0, b: 2.1 } });
    expect(r.bodies[1]).toEqual({ postPress: { l: null, a: null, b: null }, postPolish: { l: 70, a: 0.1, b: 2.2 } });
    expect(r.remarks).toBe("Slight shade variation");
  });

  it("checks what is typed: L 0–100, a / b −128…128, N 1–20 whole", () => {
    const bad = productionFormSchema.safeParse({
      ...blank(),
      numberOfBodies: "1.5",
      bodies: [{ postPress: reading("101", "abc", "-129"), postPolish: reading("", "", "") }],
    });
    expect(bad.success).toBe(false);
    const errs = fieldErrorsOf(bad.error!.issues);
    expect(Object.keys(errs).sort()).toEqual(["bodies.0.postPress.a", "bodies.0.postPress.b", "bodies.0.postPress.l", "numberOfBodies"]);
    expect(errs["bodies.0.postPress.l"]).toBe("L must be at most 100.");
    expect(productionFormSchema.safeParse({ ...blank(), numberOfBodies: "21" }).success).toBe(false);
  });

  it("only Body 1 … N count: readings kept above N are neither validated nor saved", () => {
    const input = {
      ...blank(),
      numberOfBodies: "1",
      bodies: [{ postPress: reading("70", "0", "1"), postPolish: reading("", "", "") }, { postPress: reading("abc", "", ""), postPolish: reading("", "", "") }],
    };
    expect(productionFormSchema.safeParse(input).success).toBe(false); // body 2 is invalid …
    const r = productionFormSchema.parse(visibleProductionInput(input)); // … but hidden, so it is ignored
    expect(r.bodies).toHaveLength(1);
  });

  it("reads Number of Bodies (N) for the body sections", () => {
    expect([bodyCount("2"), bodyCount(" 3 "), bodyCount(""), bodyCount("0"), bodyCount("21"), bodyCount("1.5"), bodyCount("abc")]).toEqual([2, 3, 0, 0, 0, 0, 0]);
    expect(emptyBodyReadings()).toEqual({ postPress: { l: "", a: "", b: "" }, postPolish: { l: "", a: "", b: "" } });
  });
});

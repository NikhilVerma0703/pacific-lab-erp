import { describe, expect, it } from "vitest";
import { emptyInwardBody, inwardFormSchema, newInwardInput } from "@/modules/inward-outward/schema";

describe("inward / outward form schema", () => {
  it("accepts a blank entry", () => {
    expect(inwardFormSchema.safeParse(newInwardInput({ serialNo: 1, today: "2026-10-05" })).success).toBe(true);
  });

  it("keeps a design and one L/a/b reading per body", () => {
    const body = (lab: { l: string; a: string; b: string }, design: "" | "PLAIN_BODY" = "") => ({ ...emptyInwardBody(), designCategory: design, lab });
    const r = inwardFormSchema.parse({
      ...newInwardInput({ serialNo: 5, today: "2026-10-05" }),
      numberOfBodies: "3",
      bodies: [body({ l: "88.2", a: "0.3", b: "4.1" }, "PLAIN_BODY"), body({ l: "70", a: "", b: "" }), body({ l: "", a: "", b: "-2" })],
    });
    expect(r.bodies.map((b) => b.lab)).toEqual([
      { l: 88.2, a: 0.3, b: 4.1 },
      { l: 70, a: null, b: null },
      { l: null, a: null, b: -2 },
    ]);
    expect(r.bodies.map((b) => b.designCategory)).toEqual(["PLAIN_BODY", null, null]);
  });

  it("rejects more body sections than bodies and bad values", () => {
    const base = newInwardInput({ serialNo: 1, today: "2026-10-05" });
    expect(inwardFormSchema.safeParse({ ...base, numberOfBodies: "1", bodies: [emptyInwardBody(), emptyInwardBody()] }).success).toBe(false);
    expect(inwardFormSchema.safeParse({ ...base, numberOfBodies: "1", bodies: [{ ...emptyInwardBody(), lab: { l: "101", a: "", b: "" } }] }).success).toBe(false);
  });
});

describe("inward entry date", () => {
  it("defaults to today and rejects invalid dates", () => {
    const base = newInwardInput({ serialNo: 1, today: "2026-10-05" });
    expect(inwardFormSchema.parse(base).entryDate).toBe("2026-10-05");
    expect(inwardFormSchema.parse({ ...base, entryDate: "" }).entryDate).toBe(null);
    expect(inwardFormSchema.safeParse({ ...base, entryDate: "05/10/2026" }).success).toBe(false);
  });
});

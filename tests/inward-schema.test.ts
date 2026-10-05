import { describe, expect, it } from "vitest";
import { inwardFormSchema, newInwardInput } from "@/modules/inward-outward/schema";

describe("inward / outward form schema", () => {
  it("accepts a blank entry", () => {
    expect(inwardFormSchema.safeParse(newInwardInput({ serialNo: 1, today: "2026-10-05" })).success).toBe(true);
  });

  it("parses one L/a/b row per body", () => {
    const r = inwardFormSchema.parse({
      ...newInwardInput({ serialNo: 5, today: "2026-10-05" }),
      numberOfBodies: "3",
      measurements: [
        { l: "88.2", a: "0.3", b: "4.1" },
        { l: "70", a: "", b: "" },
        { l: "", a: "", b: "-2" },
      ],
    });
    expect(r.measurements).toEqual([
      { l: 88.2, a: 0.3, b: 4.1 },
      { l: 70, a: null, b: null },
      { l: null, a: null, b: -2 },
    ]);
  });

  it("rejects more L/a/b rows than bodies and bad values", () => {
    const base = newInwardInput({ serialNo: 1, today: "2026-10-05" });
    expect(inwardFormSchema.safeParse({ ...base, numberOfBodies: "1", measurements: [{ l: "", a: "", b: "" }, { l: "", a: "", b: "" }] }).success).toBe(false);
    expect(inwardFormSchema.safeParse({ ...base, numberOfBodies: "1", measurements: [{ l: "101", a: "", b: "" }] }).success).toBe(false);
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

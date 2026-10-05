import { describe, expect, it } from "vitest";
import { designsOf, tallyDesigns } from "@/modules/dashboard/designs";
import { plantDayBounds } from "@/lib/plant-time";

describe("designs worked on", () => {
  it("merges case/space variants and ranks by count", () => {
    expect(tallyDesigns(["CARRARA", "carrara ", "Kreos", null, "", "Calacatta  Gold"])).toEqual([
      { name: "CARRARA", count: 2 },
      { name: "Calacatta Gold", count: 1 },
      { name: "Kreos", count: 1 },
    ]);
  });
  it("Plain Body is a design; patterns only count for non-plain; inward names are added", () => {
    expect(designsOf({ designCategory: "PLAIN_BODY", patterns: ["VEIN"] })).toEqual(["Plain Body"]);
    expect(designsOf({ designCategory: "NON_PLAIN_BODY", patterns: ["VEIN", "ROY BODY"], designName: "Calacatta" })).toEqual([
      "VEIN",
      "ROY BODY",
      "Calacatta",
    ]);
    expect(designsOf({ designCategory: null, patterns: [] })).toEqual([]);
  });
});

describe("plant day bounds", () => {
  it("starts at local midnight in Asia/Kolkata", () => {
    process.env.APP_TIMEZONE = "Asia/Kolkata";
    const { start, end } = plantDayBounds("2026-10-05");
    expect(start.toISOString()).toBe("2026-10-04T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-05T18:30:00.000Z");
  });
});

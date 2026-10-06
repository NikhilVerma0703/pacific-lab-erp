import { describe, expect, it } from "vitest";
import { tallyDesigns } from "@/modules/dashboard/designs";
import { designNamesOf } from "@/modules/samples/bodies";
import { plantDayBounds } from "@/lib/plant-time";

describe("designs worked on", () => {
  it("merges case/space variants and ranks by count", () => {
    expect(tallyDesigns(["CARRARA", "carrara ", "Kreos", null, "", "Calacatta  Gold"])).toEqual([
      { name: "CARRARA", count: 2 },
      { name: "Calacatta Gold", count: 1 },
      { name: "Kreos", count: 1 },
    ]);
  });
  it("Plain Body is a design; patterns only count for non-plain; every body counts once", () => {
    const p = (label: string) => ({ label });
    expect(designNamesOf([{ designCategory: "PLAIN_BODY", patterns: [p("VEIN")] }])).toEqual(["Plain Body"]);
    expect(
      designNamesOf([
        { designCategory: "NON_PLAIN_BODY", patterns: [p("VEIN"), p("ROY BODY")] },
        { designCategory: "PLAIN_BODY", patterns: [] },
        { designCategory: "NON_PLAIN_BODY", patterns: [p("VEIN")] },
      ]),
    ).toEqual(["VEIN", "ROY BODY", "Plain Body"]);
    expect(designNamesOf([{ designCategory: null, patterns: [] }])).toEqual([]);
    expect(designNamesOf([{ designCategory: "NON_PLAIN_BODY", patterns: [] }], "Non-Plain (no pattern)")).toEqual(["Non-Plain (no pattern)"]);
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

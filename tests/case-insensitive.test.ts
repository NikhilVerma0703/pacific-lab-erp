import { describe, expect, it } from "vitest";
import { compareLabels, normalizeKey, sameText } from "@/lib/normalize";
import { tallyDesigns } from "@/modules/dashboard/designs";
import { buildReport } from "@/modules/reports/build";
import { unionLabels, unionValues, veinDetailsText } from "@/modules/samples/bodies";

describe("text values are case-insensitive everywhere", () => {
  it("qwety, Qwety and qwetY are one value", () => {
    expect(new Set(["qwety", "Qwety", "qwetY", " QWETY "].map(normalizeKey)).size).toBe(1);
    expect(sameText("qwetY", "Qwety")).toBe(true);
    expect(sameText("Qwety", "Qwerty")).toBe(false);
  });

  it("sorts ignoring case", () => {
    expect(["banana", "Zebra", "apple", "Apple"].sort(compareLabels).map((x) => x.toLowerCase())).toEqual(["apple", "apple", "banana", "zebra"]);
  });

  it("merges summaries, tallies and reports by name ignoring case", () => {
    expect(unionLabels([[{ label: "Glass" }], [{ label: "GLASS" }, { label: "Pure" }]])).toEqual(["Glass", "Pure"]);
    expect(unionValues([[{ label: "white" }], [{ label: "White" }]])).toHaveLength(1);
    expect(tallyDesigns(["Calacatta", "calacatta", "CALACATTA "])).toEqual([{ name: "Calacatta", count: 3 }]);
    const r = buildReport(
      [
        { date: "2026-10-07", designs: ["Carrara", "CARRARA"], components: [] },
        { date: "2026-10-07", designs: ["carrara"], components: [] },
      ],
      "2026-10-07",
      7,
    );
    expect(r.designs).toEqual([{ pattern: "Carrara", count: 2 }]);
  });

  it("vein details text skips an earlier typed text that is already a value", () => {
    expect(veinDetailsText([{ label: "Thin White" }], "thin white")).toBe("Thin White");
    expect(veinDetailsText([{ label: "Thin White" }], "Diagonal")).toBe("Thin White, Diagonal");
    expect(veinDetailsText([], null)).toBe("");
  });
});

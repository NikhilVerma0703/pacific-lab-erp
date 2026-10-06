import { describe, expect, it } from "vitest";
import { buildReport, dateWindow, parseRange, type ReportSampleRow } from "@/modules/reports/build";

const s = (over: Partial<ReportSampleRow>): ReportSampleRow => ({
  date: "2026-10-05",
  typeCode: "CREATIVE",
  designs: [],
  components: [],
  ...over,
});

describe("report window", () => {
  it("covers N days ending today, oldest first", () => {
    expect(dateWindow("2026-10-05", 7)).toEqual([
      "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
    ]);
  });
  it("only accepts 7 / 15 / 30", () => {
    expect(parseRange("15")).toBe(15);
    expect(parseRange("99")).toBe(7);
    expect(parseRange(undefined)).toBe(7);
  });
});

describe("buildReport", () => {
  const rows = [
    s({ date: "2026-10-05", designs: ["CARRARA", "ROY BODY"],
        components: [
          { kind: "RESIN", material: "INEOS", unit: "GRAMS", quantity: 1200 },
          { kind: "RESIN", material: "ABC", unit: "PERCENT", quantity: 30 },
          { kind: "PIGMENT", material: "White", unit: "GRAMS", quantity: 12 },
        ] }),
    s({ date: "2026-10-05", typeCode: "INSPIRED", designs: ["Plain Body"] }),
    s({ date: "2026-10-03", designs: ["CARRARA"],
        components: [{ kind: "RESIN", material: "INEOS", unit: "GRAMS", quantity: 300 }] }),
    s({ date: "2026-09-01", components: [{ kind: "RESIN", material: "INEOS", unit: "GRAMS", quantity: 9999 }] }), // outside
  ];
  const r = buildReport(rows, "2026-10-05", 7);

  it("counts samples per date inside the window only", () => {
    expect(r.totals.samples).toBe(3);
    expect(r.production.find((d) => d.date === "2026-10-05")!.count).toBe(2);
    expect(r.production.find((d) => d.date === "2026-10-04")!.count).toBe(0);
    expect(r.production).toHaveLength(7);
  });

  it("splits creative and inspired", () => {
    expect(r.creativeVsInspired.find((d) => d.date === "2026-10-05")).toEqual({ date: "2026-10-05", creative: 1, inspired: 1 });
  });

  it("ranks design patterns, Plain Body included", () => {
    expect(r.designs).toEqual([
      { pattern: "CARRARA", count: 2 },
      { pattern: "Plain Body", count: 1 },
      { pattern: "ROY BODY", count: 1 },
    ]);
  });

  it("sums grams per material and keeps % out of the weight", () => {
    const resin = r.consumption.RESIN;
    expect(resin.totalGrams).toBe(1500);
    expect(resin.percentRows).toBe(1);
    expect(resin.byMaterial).toEqual([{ material: "INEOS", grams: 1500 }]);
    expect(resin.byDate.find((d) => d.date === "2026-10-03")!.INEOS).toBe(300);
    expect(r.consumption.PIGMENT.totalGrams).toBe(12);
    expect(r.consumption.FILLER.totalGrams).toBe(0);
  });

  it("folds materials beyond the series limit into Other", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      s({ components: [{ kind: "PIGMENT", material: `C${i}`, unit: "GRAMS", quantity: 10 + i }] }),
    );
    const p = buildReport(many, "2026-10-05", 7).consumption.PIGMENT;
    expect(p.series).toHaveLength(6);
    expect(p.series[5]).toBe("Other");
    expect(p.byDate.at(-1)!.Other).toBe(10 + 11 + 12); // 5 named + Other: C0..C2 folded
  });
});

describe("production samples per date", () => {
  it("counts each production sample on its date, zero-filled across the window", () => {
    const r = buildReport([], "2026-10-05", 7, ["2026-10-05", "2026-10-05", "2026-10-02", "2026-09-01"]);
    expect(r.productionSamples).toHaveLength(7);
    expect(r.productionSamples.find((d) => d.date === "2026-10-05")?.count).toBe(2);
    expect(r.productionSamples.find((d) => d.date === "2026-10-02")?.count).toBe(1);
    expect(r.productionSamples.find((d) => d.date === "2026-10-04")?.count).toBe(0);
    expect(r.totals.productionSamples).toBe(3); // 2026-09-01 is outside the 7 days
    expect(buildReport([], "2026-10-05", 30, ["2026-09-10"]).totals.productionSamples).toBe(1);
  });
});

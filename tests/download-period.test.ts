import { describe, expect, it } from "vitest";
import { inPeriod, parsePeriod, periodFileTag, periodLabel, periodProblem, periodQuery, periodWhere } from "@/modules/downloads/period";

const today = "2026-10-06";

describe("Production Date period", () => {
  it("defaults to Date Wise today, and reads a bare date as Date Wise", () => {
    expect(parsePeriod({}, today)).toMatchObject({ mode: "date", date: today });
    expect(parsePeriod({ date: "2026-10-01" }, today)).toMatchObject({ mode: "date", date: "2026-10-01" });
  });
  it("All runs from the beginning up to today", () => {
    const p = parsePeriod({ period: "all" }, today);
    expect(p).toMatchObject({ mode: "all", to: today });
    expect(inPeriod("2020-01-01", p)).toBe(true);
    expect(inPeriod(today, p)).toBe(true);
    expect(inPeriod("2026-10-07", p)).toBe(false);
    expect(periodWhere(p)).toEqual({ lte: new Date(`${today}T00:00:00Z`) });
  });
  it("Date Range is inclusive and is put the right way round", () => {
    const p = parsePeriod({ period: "range", from: "2026-10-05", to: "2026-10-01" }, today);
    expect(p).toMatchObject({ from: "2026-10-01", to: "2026-10-05" });
    expect(["2026-09-30", "2026-10-01", "2026-10-03", "2026-10-05", "2026-10-06"].map((d) => inPeriod(d, p))).toEqual([false, true, true, true, false]);
    expect(periodWhere(p)).toEqual({ gte: new Date("2026-10-01T00:00:00Z"), lte: new Date("2026-10-05T00:00:00Z") });
  });
  it("round-trips through the URL and names the file", () => {
    for (const q of [{ period: "all" }, { period: "date", date: "2026-10-02" }, { period: "range", from: "2026-09-01", to: "2026-10-02" }]) {
      expect(periodQuery(parsePeriod(q, today))).toEqual(q);
    }
    expect(periodFileTag(parsePeriod({ period: "range", from: "2026-09-01", to: "2026-10-02" }, today))).toBe("2026-09-01_to_2026-10-02");
    expect(periodFileTag(parsePeriod({ period: "all" }, today))).toBe("All_upto_2026-10-06");
    expect(periodLabel(parsePeriod({ period: "date", date: "2026-10-02" }, today))).toBe("02 Oct 2026");
  });
  it("flags an incomplete or reversed range in the form", () => {
    expect(periodProblem({ mode: "range", date: "", from: "2026-10-05", to: "" })).toMatch(/both/);
    expect(periodProblem({ mode: "range", date: "", from: "2026-10-05", to: "2026-10-01" })).toMatch(/on or before/);
    expect(periodProblem({ mode: "all", date: "", from: "", to: "" })).toBeNull();
    expect(periodProblem({ mode: "date", date: "", from: "", to: "" })).toMatch(/date/);
  });
});

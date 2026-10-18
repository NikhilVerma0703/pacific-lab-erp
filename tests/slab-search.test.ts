import { describe, expect, it } from "vitest";
import { measurementQuery, parameterQuery, parseMeasurementSearch, parseParameterSearch, readNumber } from "@/modules/slab-records/search";

const TODAY = "2026-10-18";

describe("Slab Records searches", () => {
  it("reads a typed number, or nothing", () => {
    expect(readNumber(" 74.8 ")).toBe(74.8);
    expect(readNumber("-0.6")).toBe(-0.6);
    expect(readNumber("1,200", { int: true })).toBe(1200);
    expect(readNumber("")).toBeNull();
    expect(readNumber("abc")).toBeNull();
    expect(readNumber("5.5", { int: true })).toBeNull();
    expect(readNumber("120", { max: 100 })).toBeNull();
  });

  it("L, a, b: all three are needed, and stay as typed for the form", () => {
    const ok = parseMeasurementSearch({ l: "74.8", a: "-0.6", b: "0.7" });
    expect(ok.values).toEqual({ l: 74.8, a: -0.6, b: 0.7 });
    expect([ok.problem, ok.raw.a]).toEqual([null, "-0.6"]);

    const partial = parseMeasurementSearch({ l: "74.8", a: "", b: "" });
    expect(partial.values).toBeNull();
    expect(partial.problem).toContain("all three");

    // Nothing typed at all is not an error — the page just shows the empty form.
    expect(parseMeasurementSearch({})).toMatchObject({ values: null, problem: null });
    // The same limits the forms use.
    expect(parseMeasurementSearch({ l: "140", a: "0", b: "0" }).values).toBeNull();
    expect(parseMeasurementSearch({ l: "74.8", a: "-200", b: "0" }).values).toBeNull();
    expect(measurementQuery({ l: "74.8", a: "-0.6", b: "0.7" })).toEqual({ find: "lab", l: "74.8", a: "-0.6", b: "0.7" });
  });

  it("any parameter: each filter is optional and survives a round trip", () => {
    const none = parseParameterSearch({}, TODAY);
    expect([none.period, none.slabNumber, none.designName, none.problem]).toEqual([null, null, "", null]);

    const all = parseParameterSearch({ period: "date", date: "2026-10-05", slab: " 5083 ", design: "  Statuario   Nuvo " }, TODAY);
    expect(all.period).toMatchObject({ mode: "date", date: "2026-10-05" });
    expect([all.slabNumber, all.designName]).toEqual([5083, "Statuario Nuvo"]);

    const range = parseParameterSearch({ period: "range", from: "2026-10-01", to: "2026-10-07" }, TODAY);
    expect(range.period).toMatchObject({ mode: "range", from: "2026-10-01", to: "2026-10-07" });

    expect(parseParameterSearch({ slab: "5a" }, TODAY).problem).toContain("whole number");

    const q = parameterQuery({ period: all.period, slab: "5083", design: "Statuario Nuvo" });
    expect(q).toMatchObject({ find: "any", period: "date", date: "2026-10-05", slab: "5083", design: "Statuario Nuvo" });
    const back = parseParameterSearch(q, TODAY);
    expect([back.slabNumber, back.designName, back.period?.mode]).toEqual([5083, "Statuario Nuvo", "date"]);
    // "Any date" keeps no period at all, so future-dated records are included too.
    expect(parameterQuery({ period: null, slab: "", design: "" })).toEqual({ find: "any" });
  });
});

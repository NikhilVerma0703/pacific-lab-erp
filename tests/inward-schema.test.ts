import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/modules/forms/fields";
import { designSummary, orderTypes } from "@/modules/forms/design-types";
import { inwardFormSchema, inwardLayout, newInwardInput, visibleInwardInput, type InwardFormInput } from "@/modules/inward-outward/schema";

const blank = (): InwardFormInput => newInwardInput({ serialNo: 12, slabNumber: 340, today: "2026-10-12" });
const r = (l: string, a: string, b: string) => ({ l, a, b });
const colour = (label: string, quantity: string) => ({ colour: { label }, quantity });

describe("Sample Inward / Outward form — layout", () => {
  it("nothing chosen yet → no N, no bodies", () => {
    expect(inwardLayout(blank())).toMatchObject({ types: [], showBodies: false, n: 0, royN: 0, chessN: 0 });
  });

  it("Plain Body – Yes → N and Body 1 … N, no design types", () => {
    const l = inwardLayout({ ...blank(), plainBody: "YES", designTypes: ["ROY_BODY"], numberOfBodies: "3", royBody: { count: "2" } });
    expect(l).toMatchObject({ types: [], showBodies: true, n: 3, royN: 0, chessN: 0 });
  });

  it("Plain Body – No without a type → N stays hidden until a type is picked", () => {
    expect(inwardLayout({ ...blank(), plainBody: "NO", numberOfBodies: "3" })).toMatchObject({ showBodies: false, n: 0 });
  });

  it("several types share one N; Roy / Chessboard add their own n; order follows the form", () => {
    const l = inwardLayout({
      ...blank(),
      plainBody: "NO",
      designTypes: ["CHESSBOARD", "CARRARA", "ROY_BODY"],
      numberOfBodies: "2",
      royBody: { count: "3" },
      chessboard: { count: "1" },
    });
    expect(l.types).toEqual(["ROY_BODY", "CARRARA", "CHESSBOARD"]);
    expect(l).toMatchObject({ showBodies: true, n: 2, royN: 3, chessN: 1 });
  });

  it("counts that are not whole numbers 1–20 give no rows", () => {
    for (const bad of ["", "0", "1.5", "21", "abc"]) expect(inwardLayout({ ...blank(), plainBody: "YES", numberOfBodies: bad }).n).toBe(0);
  });

  it("design in a few words", () => {
    expect(designSummary(true, [])).toBe("Plain Body");
    expect(designSummary(false, ["CARRARA", "ROY_BODY"])).toBe("Roy Body, Carrara");
    expect(designSummary(false, [])).toBe("Non-Plain Body");
    expect(designSummary(null, [])).toBe("");
    expect(orderTypes(["VEIN", "KREOS", "nope"])).toEqual(["KREOS", "VEIN"]);
  });
});

describe("Sample Inward / Outward form — schema", () => {
  it("has the five Sample Details fields, the design part, three reading groups, files and remarks", () => {
    expect(Object.keys(blank()).sort()).toEqual(
      [
        "entryDate", "serialNo", "slabNumber", "company", "designName",
        "plainBody", "designTypes", "numberOfBodies", "royBody", "kreos", "carrara", "vein", "chessboard",
        "bodies", "royBodies", "chessboardBodies",
        "attachmentIds", "remarks",
      ].sort(),
    );
  });

  it("accepts a blank entry (nothing is mandatory)", () => {
    const d = inwardFormSchema.parse(visibleInwardInput(blank()));
    expect(d).toMatchObject({ serialNo: 12, slabNumber: 340, entryDate: "2026-10-12", company: null, designName: null, plainBody: null, designTypes: [], numberOfBodies: null, bodies: [], remarks: null });
  });

  it("Case A: Plain Body – Yes, N = 3 → Body 1, 2, 3 with one L, a, b each", () => {
    const d = inwardFormSchema.parse(
      visibleInwardInput({
        ...blank(),
        company: { id: "c1", label: "Stone Co" },
        designName: { label: "Bianco" },
        plainBody: "YES",
        numberOfBodies: "3",
        bodies: [r("72", "-0.5", "2"), r("", "", ""), r("70.1", "0", "1.9")],
        remarks: "  ok ",
      }),
    );
    expect(d.plainBody).toBe(true);
    expect(d.numberOfBodies).toBe(3);
    expect(d.bodies).toEqual([{ l: 72, a: -0.5, b: 2 }, { l: null, a: null, b: null }, { l: 70.1, a: 0, b: 1.9 }]);
    expect(d.remarks).toBe("ok");
  });

  it("Case B: Roy Body + Carrara → one N, Roy n, Carrara colours with quantities", () => {
    const d = inwardFormSchema.parse(
      visibleInwardInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["CARRARA", "ROY_BODY"],
        numberOfBodies: "2",
        royBody: { count: "1" },
        carrara: { colours: [colour("Grey", "12.5"), colour("Black", "")] },
        bodies: [r("70", "0", "1"), r("71", "0", "1")],
        royBodies: [r("60", "1", "-2")],
      }),
    );
    expect(d.designTypes).toEqual(["ROY_BODY", "CARRARA"]);
    expect(d.royBody.count).toBe(1);
    expect(d.carrara.colours).toEqual([
      { colour: { label: "Grey" }, quantity: 12.5 },
      { colour: { label: "Black" }, quantity: null },
    ]);
    expect(d.bodies).toHaveLength(2);
    expect(d.royBodies).toEqual([{ l: 60, a: 1, b: -2 }]);
  });

  it("Kreos with Vein Present – Yes keeps Mixer Type, Vein Details and colours", () => {
    const d = inwardFormSchema.parse(
      visibleInwardInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["KREOS"],
        kreos: { veinPresent: "YES", mixerType: { label: "Grit" }, veinDetails: [{ label: "Thin gold" }], colours: [colour("Gold", "4")] },
      }),
    );
    expect(d.kreos).toEqual({ veinPresent: true, mixerType: { label: "Grit" }, veinDetails: [{ label: "Thin gold" }], colours: [{ colour: { label: "Gold" }, quantity: 4 }] });
  });

  it("Vein Present – No drops Mixer Type, Vein Details and colours", () => {
    const d = inwardFormSchema.parse(
      visibleInwardInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["VEIN"],
        vein: { veinPresent: "NO", mixerType: { label: "Filler" }, veinDetails: [{ label: "x" }], colours: [colour("Gold", "abc")] },
      }),
    );
    expect(d.vein).toEqual({ veinPresent: false, mixerType: null, veinDetails: [], colours: [] });
  });

  it("checks what is typed: counts 1–20 whole, quantities ≥ 0, L 0–100, a / b −128…128", () => {
    const bad = inwardFormSchema.safeParse(
      visibleInwardInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["ROY_BODY", "CARRARA"],
        numberOfBodies: "1",
        royBody: { count: "1.5" },
        carrara: { colours: [colour("Grey", "-1")] },
        bodies: [r("101", "abc", "-129")],
      }),
    );
    expect(bad.success).toBe(false);
    expect(Object.keys(fieldErrorsOf(bad.error!.issues)).sort()).toEqual(
      ["bodies.0.a", "bodies.0.b", "bodies.0.l", "carrara.colours.0.quantity", "royBody.count"].sort(),
    );
  });

  it("the same colour twice (any letter case) is flagged", () => {
    const bad = inwardFormSchema.safeParse(
      visibleInwardInput({ ...blank(), plainBody: "NO", designTypes: ["CARRARA"], carrara: { colours: [colour("Grey", "1"), colour(" grey ", "2")] } }),
    );
    expect(bad.success).toBe(false);
  });
});

describe("Sample Inward / Outward form — only what is shown is validated and saved", () => {
  it("Plain Body – Yes drops every design type and their fields", () => {
    const v = visibleInwardInput({
      ...blank(),
      plainBody: "YES",
      designTypes: ["ROY_BODY", "VEIN"],
      numberOfBodies: "1",
      royBody: { count: "abc" },
      vein: { veinPresent: "YES", mixerType: { label: "Pure" }, veinDetails: [], colours: [] },
      bodies: [r("70", "0", "0")],
      royBodies: [r("abc", "", "")],
    });
    expect(v.designTypes).toEqual([]);
    expect(v.royBody).toEqual({ count: "" });
    expect(v.vein.veinPresent).toBe("");
    expect(v.royBodies).toEqual([]);
    expect(inwardFormSchema.safeParse(v).success).toBe(true);
  });

  it("a type that is not selected drops its fields", () => {
    const v = visibleInwardInput({
      ...blank(),
      plainBody: "NO",
      designTypes: ["CARRARA"],
      chessboard: { count: "x" },
      kreos: { veinPresent: "YES", mixerType: { label: "Grit" }, veinDetails: [], colours: [colour("Gold", "-5")] },
      chessboardBodies: [r("abc", "", "")],
    });
    expect(v.chessboard).toEqual({ count: "" });
    expect(v.kreos).toEqual({ veinPresent: "", mixerType: null, veinDetails: [], colours: [] });
    expect(v.chessboardBodies).toEqual([]);
    expect(inwardFormSchema.safeParse(v).success).toBe(true);
  });

  it("only Body 1 … N, Roy Body 1 … n and Chessboard Body 1 … n are kept", () => {
    const v = visibleInwardInput({
      ...blank(),
      plainBody: "NO",
      designTypes: ["ROY_BODY", "CHESSBOARD"],
      numberOfBodies: "1",
      royBody: { count: "2" },
      chessboard: { count: "1" },
      bodies: [r("70", "", ""), r("abc", "", "")],
      royBodies: [r("1", "", ""), r("2", "", ""), r("abc", "", "")],
      chessboardBodies: [r("3", "", ""), r("abc", "", "")],
    });
    expect(v.bodies).toHaveLength(1);
    expect(v.royBodies).toHaveLength(2);
    expect(v.chessboardBodies).toHaveLength(1);
    expect(inwardFormSchema.safeParse(v).success).toBe(true);
  });

  it("Plain Body – No with no type yet → N is not saved", () => {
    const v = visibleInwardInput({ ...blank(), plainBody: "NO", numberOfBodies: "4", bodies: [r("70", "", "")] });
    expect(v.numberOfBodies).toBe("");
    expect(v.bodies).toEqual([]);
  });
});

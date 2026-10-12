import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/modules/forms/fields";
import { emptyMaterials, materialsAreEmpty, materialsSchema, type MaterialsInput } from "@/modules/forms/materials";
import { labFormSchema, labLayout, newLabInput, visibleLabInput, type LabFormInput } from "@/modules/samples/schema";

const blank = (): LabFormInput => newLabInput({ serialNo: 97, slabNumber: 5100, today: "2026-10-12" });
const r = (l: string, a: string, b: string) => ({ l, a, b });
const body = (pp: [string, string, string], pl: [string, string, string]) => ({ postPress: r(...pp), postPolish: r(...pl) });
const mats = (over: Partial<MaterialsInput> = {}): MaterialsInput => ({ ...emptyMaterials(), ...over });
const v = (label: string, id?: string) => (id ? { id, label } : { label });

describe("Lab Sample form — structure", () => {
  it("has the four Basic Information fields, the design part, materials, readings, files and remarks", () => {
    expect(Object.keys(blank()).sort()).toEqual(
      [
        "sampleDate", "serialNo", "slabNumber", "designName",
        "plainBody", "designTypes", "numberOfBodies",
        "materials", "royBody", "kreos", "carrara", "vein", "chessboard",
        "readings", "royReadings", "chessboardReadings",
        "attachmentIds", "remarks",
      ].sort(),
    );
  });

  it("a body's Material Details start with one Resin, Grits and Filler row and no pigments / additives", () => {
    expect(emptyMaterials()).toEqual({
      resins: [{ material: null, quantity: "", unit: "" }],
      grits: [{ material: null, size: null, quantity: "", unit: "" }],
      fillers: [{ material: null, quantity: "", unit: "" }],
      pigments: [],
      additives: [],
    });
    expect(materialsAreEmpty(materialsSchema.parse(emptyMaterials()))).toBe(true);
  });

  it("accepts a blank sample (nothing is mandatory)", () => {
    const d = labFormSchema.parse(visibleLabInput(blank()));
    expect(d).toMatchObject({ serialNo: 97, slabNumber: 5100, sampleDate: "2026-10-12", designName: null, plainBody: null, numberOfBodies: null, materials: [], readings: [], remarks: null });
  });

  it("layout: Roy Body + Carrara share one N; Roy n adds its own bodies", () => {
    const l = labLayout({ ...blank(), plainBody: "NO", designTypes: ["CARRARA", "ROY_BODY"], numberOfBodies: "3", royBody: { count: "2" } });
    expect(l).toMatchObject({ types: ["ROY_BODY", "CARRARA"], showBodies: true, n: 3, royN: 2, chessN: 0 });
  });
});

describe("Lab Sample form — Plain Body – Yes", () => {
  it("N = 2 → Material Details and a Post Press / Post Polish row for Body 1 and Body 2", () => {
    const d = labFormSchema.parse(
      visibleLabInput({
        ...blank(),
        designName: v("Bianco Lab"),
        plainBody: "YES",
        numberOfBodies: "2",
        materials: [
          mats({
            resins: [{ material: v("INEOS 120"), quantity: "1200", unit: "" }],
            grits: [{ material: v("Quartz"), size: v("0.1–0.4 mm"), quantity: "800", unit: "" }],
            fillers: [{ material: v("LY"), quantity: "300", unit: "" }],
            pigments: [{ colour: v("White", "c1"), quantity: "12.5" }],
            additives: [{ colour: v("UV stabiliser"), quantity: "2" }],
          }),
          mats(),
        ],
        readings: [body(["72", "0.1", "2"], ["71", "0", "2.1"]), body(["", "", ""], ["70", "0", "1.9"])],
      }),
    );
    expect(d.plainBody).toBe(true);
    expect(d.materials).toHaveLength(2);
    expect(d.materials[0].resins[0]).toEqual({ material: { label: "INEOS 120" }, quantity: 1200, unit: null });
    expect(d.materials[0].grits[0]).toEqual({ material: { label: "Quartz" }, size: { label: "0.1–0.4 mm" }, quantity: 800, unit: null });
    expect(d.materials[0].pigments[0]).toEqual({ colour: { id: "c1", label: "White" }, quantity: 12.5, unit: null });
    expect(d.materials[0].additives[0]).toEqual({ colour: { label: "UV stabiliser" }, quantity: 2, unit: null });
    expect(d.readings[1]).toEqual({ postPress: { l: null, a: null, b: null }, postPolish: { l: 70, a: 0, b: 1.9 } });
  });
});

describe("Lab Sample form — Plain Body – No", () => {
  it("Roy Body (N = 3, n = 2) + Carrara: Material Details for Body 1–3 and Roy Body 1–2; readings for both", () => {
    const d = labFormSchema.parse(
      visibleLabInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["CARRARA", "ROY_BODY"],
        numberOfBodies: "3",
        materials: [mats(), mats(), mats()],
        royBody: { count: "2", materials: [mats({ resins: [{ material: v("Roy resin"), quantity: "50", unit: "" }] }), mats()] },
        carrara: { colours: [{ colour: v("Grey"), quantity: "4" }] },
        readings: [body(["70", "", ""], ["", "", ""]), body(["", "", ""], ["", "", ""]), body(["", "", ""], ["", "", ""])],
        royReadings: [body(["60", "1", "1"], ["59", "1", "1"]), body(["", "", ""], ["", "", ""])],
      }),
    );
    expect(d.designTypes).toEqual(["ROY_BODY", "CARRARA"]);
    expect(d.materials).toHaveLength(3);
    expect(d.royBody.count).toBe(2);
    expect(d.royBody.materials).toHaveLength(2);
    expect(d.royBody.materials[0].resins[0].material).toEqual({ label: "Roy resin" });
    expect(d.carrara.colours).toEqual([{ colour: { label: "Grey" }, quantity: 4 }]);
    expect(d.readings).toHaveLength(3);
    expect(d.royReadings[0].postPolish).toEqual({ l: 59, a: 1, b: 1 });
  });

  it("Chessboard works like Roy Body with Number of Chessboard Body (n)", () => {
    const d = labFormSchema.parse(
      visibleLabInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["CHESSBOARD"],
        numberOfBodies: "1",
        chessboard: { count: "2", materials: [mats(), mats(), mats()] },
        chessboardReadings: [body(["40", "", ""], ["", "", ""]), body(["", "", ""], ["41", "", ""]), body(["abc", "", ""], ["", "", ""])],
      }),
    );
    expect(d.chessboard.materials).toHaveLength(2);
    expect(d.chessboardReadings).toHaveLength(2);
  });

  it("Kreos / Vein: Vein Present – No drops Mixer Type, Vein Details and colours", () => {
    const d = labFormSchema.parse(
      visibleLabInput({
        ...blank(),
        plainBody: "NO",
        designTypes: ["KREOS", "VEIN"],
        kreos: { veinPresent: "YES", mixerType: v("Resin Blend"), veinDetails: [v("Thin")], colours: [{ colour: v("Gold"), quantity: "3" }] },
        vein: { veinPresent: "NO", mixerType: v("GRIT"), veinDetails: [v("x")], colours: [{ colour: v("Black"), quantity: "-1" }] },
      }),
    );
    expect(d.kreos).toEqual({ veinPresent: true, mixerType: { label: "Resin Blend" }, veinDetails: [{ label: "Thin" }], colours: [{ colour: { label: "Gold" }, quantity: 3 }] });
    expect(d.vein).toEqual({ veinPresent: false, mixerType: null, veinDetails: [], colours: [] });
  });
});

describe("Lab Sample form — what is typed must make sense", () => {
  it("a quantity needs its resin / filler; size or quantity need a grit", () => {
    const bad = materialsSchema.safeParse(
      mats({
        resins: [{ material: null, quantity: "5", unit: "" }],
        grits: [{ material: null, size: v("0.3–0.7 mm"), quantity: "", unit: "" }],
        fillers: [{ material: { label: "  " }, quantity: "1", unit: "" }],
      }),
    );
    expect(bad.success).toBe(false);
    expect(Object.keys(fieldErrorsOf(bad.error!.issues)).sort()).toEqual(["fillers.0.material", "grits.0.material", "resins.0.material"]);
  });

  it("the same resin twice (any letter case) is flagged; the same grit with another size is fine", () => {
    const resins = materialsSchema.safeParse(
      mats({ resins: [{ material: v("INEOS"), quantity: "1", unit: "" }, { material: v(" ineos "), quantity: "2", unit: "" }] }),
    );
    expect(resins.success).toBe(false);
    expect(Object.keys(fieldErrorsOf(resins.error!.issues))).toEqual(["resins.1.material"]);

    const grits = materialsSchema.safeParse(
      mats({
        grits: [
          { material: v("Quartz"), size: v("Fine"), quantity: "1", unit: "" },
          { material: v("QUARTZ"), size: v("Coarse"), quantity: "2", unit: "" },
        ],
      }),
    );
    expect(grits.success).toBe(true);
    const sameSize = materialsSchema.safeParse(
      mats({
        grits: [
          { material: v("Quartz"), size: v("Fine"), quantity: "1", unit: "" },
          { material: v("quartz"), size: v("fine"), quantity: "2", unit: "" },
        ],
      }),
    );
    expect(sameSize.success).toBe(false);
  });

  it("the same additive twice is flagged; quantities must be numbers ≥ 0; a kept percentage ≤ 100", () => {
    expect(materialsSchema.safeParse(mats({ additives: [{ colour: v("Wax"), quantity: "" }, { colour: v("WAX"), quantity: "" }] })).success).toBe(false);
    const bad = materialsSchema.safeParse(mats({ resins: [{ material: v("A"), quantity: "-3", unit: "" }], pigments: [{ colour: v("Grey"), quantity: "x" }] }));
    expect(Object.keys(fieldErrorsOf(bad.error!.issues)).sort()).toEqual(["pigments.0.quantity", "resins.0.quantity"]);
    expect(materialsSchema.safeParse(mats({ grits: [{ material: v("Old"), size: null, quantity: "120", unit: "PERCENT" }] })).success).toBe(false);
    expect(materialsSchema.safeParse(mats({ grits: [{ material: v("Old"), size: null, quantity: "30", unit: "PERCENT" }] })).success).toBe(true);
  });

  it("L 0–100, a / b −128…128 on both Post Press and Post Polish", () => {
    const bad = labFormSchema.safeParse(
      visibleLabInput({ ...blank(), plainBody: "YES", numberOfBodies: "1", readings: [body(["101", "", ""], ["", "200", ""])] }),
    );
    expect(Object.keys(fieldErrorsOf(bad.error!.issues)).sort()).toEqual(["readings.0.postPolish.a", "readings.0.postPress.l"]);
  });
});

describe("Lab Sample form — only what is shown is validated and saved", () => {
  it("Plain Body – Yes drops every design type with its bodies and fields", () => {
    const vis = visibleLabInput({
      ...blank(),
      plainBody: "YES",
      designTypes: ["ROY_BODY", "CARRARA"],
      numberOfBodies: "1",
      materials: [mats()],
      royBody: { count: "x", materials: [mats({ resins: [{ material: null, quantity: "9", unit: "" }] })] },
      carrara: { colours: [{ colour: v("Grey"), quantity: "-1" }] },
      royReadings: [body(["abc", "", ""], ["", "", ""])],
    });
    expect(vis.designTypes).toEqual([]);
    expect(vis.royBody).toEqual({ count: "", materials: [] });
    expect(vis.carrara).toEqual({ colours: [] });
    expect(vis.royReadings).toEqual([]);
    expect(labFormSchema.safeParse(vis).success).toBe(true);
  });

  it("bodies above N (and Roy / Chessboard bodies above n) are ignored", () => {
    const vis = visibleLabInput({
      ...blank(),
      plainBody: "NO",
      designTypes: ["ROY_BODY"],
      numberOfBodies: "1",
      materials: [mats(), mats({ resins: [{ material: null, quantity: "5", unit: "" }] })],
      royBody: { count: "1", materials: [mats(), mats({ fillers: [{ material: null, quantity: "1", unit: "" }] })] },
      readings: [body(["70", "", ""], ["", "", ""]), body(["abc", "", ""], ["", "", ""])],
      royReadings: [body(["", "", ""], ["", "", ""]), body(["abc", "", ""], ["", "", ""])],
    });
    expect(vis.materials).toHaveLength(1);
    expect(vis.royBody.materials).toHaveLength(1);
    expect(vis.readings).toHaveLength(1);
    expect(vis.royReadings).toHaveLength(1);
    expect(labFormSchema.safeParse(vis).success).toBe(true);
  });

  it("Plain Body – No with no type yet → no N, no bodies", () => {
    const vis = visibleLabInput({ ...blank(), plainBody: "NO", numberOfBodies: "2", materials: [mats(), mats()] });
    expect(vis.numberOfBodies).toBe("");
    expect(vis.materials).toEqual([]);
  });
});

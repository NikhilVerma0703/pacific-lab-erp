/**
 * Lab Sample form — one definition, used by React Hook Form in the browser
 * and re-run by the server action before anything is written.
 *
 *   1 Basic Information — Date, S.No., Slab Number, Design Name
 *   2 Design Type and Number of Bodies — Plain Body – Yes / No; with No, the
 *     design types (Roy Body, Kreos, Carrara, Vein, Chessboard); Number of
 *     Bodies (N) once, shared by every type
 *   3 Material Details — Body 1 … N, each: Resin, Grits (+ Size of Grit),
 *     Filler, Pigments (Color Used), Additives — all Quantity (gm)
 *   then, per selected type:
 *     Roy Body Details   — Number of Roy Body (n) + Material Details of Roy Body 1 … n
 *     Kreos Vein Details — Vein Present – Yes / No (+ Mixer Type, Vein Details, Kreos Vein Colors Used)
 *     Carrara Details    — Carrara Colors Used
 *     Vein Details       — as Kreos, with Vein Colors Used
 *     Chessboard Details — Number of Chessboard Body (n) + Material Details of each
 *   L, a, b Measurements — one row per body (Body 1 … N, Roy Body 1 … n,
 *     Chessboard Body 1 … n), each Post Press L, a, b and Post Polish L, a, b
 *   Sample Output (files), Remarks
 *
 * Nothing is mandatory; what is typed must make sense. Only what the form
 * shows is validated and saved (`visibleLabInput`).
 */
import { z } from "zod";
import { countOf, designLayout, emptyVeinType, veinTypeSchema, visibleVeinType } from "@/modules/forms/design";
import { DESIGN_TYPE_KEYS } from "@/modules/forms/design-types";
import { bodyReadingsSchema, colourQuantitiesSchema, emptyBodyReadings, masterRefSchema, MAX_BODIES, optionalDate, optionalNumber, optionalText, yesNoSchema } from "@/modules/forms/fields";
import { emptyMaterials, materialsSchema } from "@/modules/forms/materials";

const materialsList = z.array(materialsSchema).max(MAX_BODIES);
const readingsList = z.array(bodyReadingsSchema).max(MAX_BODIES);

export const labFormSchema = z.object({
  // 1 · Basic Information
  sampleDate: optionalDate(),
  serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "S.No." }),
  slabNumber: optionalNumber({ min: 1, max: 999_999_999, int: true, label: "Slab Number" }),
  /** Design Name — from the Design Names list, or a new name typed via Other…. */
  designName: masterRefSchema.nullable(),

  // 2 · Design Type and Number of Bodies
  /** Plain Body – Yes (true) / No (false). */
  plainBody: yesNoSchema,
  /** Plain Body – No: the selected design types. */
  designTypes: z.array(z.enum(DESIGN_TYPE_KEYS)).max(DESIGN_TYPE_KEYS.length),
  /** Number of Bodies (N) — once, shared by every design type. */
  numberOfBodies: countOf("Number of Bodies (N)"),

  // 3 · Material Details of Body 1 … N
  materials: materialsList,

  // the design types' own details
  royBody: z.object({ count: countOf("Number of Roy Body (n)"), materials: materialsList }),
  kreos: veinTypeSchema,
  carrara: z.object({ colours: colourQuantitiesSchema }),
  vein: veinTypeSchema,
  chessboard: z.object({ count: countOf("Number of Chessboard Body (n)"), materials: materialsList }),

  // L, a, b Measurements — Post Press and Post Polish per body
  readings: readingsList,
  royReadings: readingsList,
  chessboardReadings: readingsList,

  // Sample Output, Remarks
  attachmentIds: z.array(z.string().min(1)).max(10, "At most 10 files per sample."),
  remarks: optionalText(4000),
});

/** What the browser holds (strings). */
export type LabFormInput = z.input<typeof labFormSchema>;
/** What the server writes (numbers / nulls). */
export type LabFormData = z.output<typeof labFormSchema>;

/** What the form shows, from the answers so far (shared by the form and the save). */
export const labLayout = designLayout;

/**
 * The sample as the form shows it: Plain Body – Yes drops the design types;
 * a type that is not selected drops its fields; Vein Present – No drops
 * Mixer Type, Vein Details and colours; only Body 1 … N, Roy Body 1 … n and
 * Chessboard Body 1 … n are kept (Material Details and readings). Hidden
 * values are neither validated nor saved — they stay in the form, so
 * switching back brings them back.
 */
export function visibleLabInput(input: LabFormInput): LabFormInput {
  const { types, has, showBodies, n, royN, chessN } = labLayout(input);
  return {
    ...input,
    designTypes: types,
    numberOfBodies: showBodies ? input.numberOfBodies : "",
    materials: (input.materials ?? []).slice(0, n),
    royBody: has("ROY_BODY") ? { count: input.royBody.count, materials: (input.royBody.materials ?? []).slice(0, royN) } : { count: "", materials: [] },
    kreos: visibleVeinType(input.kreos, has("KREOS")),
    carrara: has("CARRARA") ? input.carrara : { colours: [] },
    vein: visibleVeinType(input.vein, has("VEIN")),
    chessboard: has("CHESSBOARD")
      ? { count: input.chessboard.count, materials: (input.chessboard.materials ?? []).slice(0, chessN) }
      : { count: "", materials: [] },
    readings: (input.readings ?? []).slice(0, n),
    royReadings: (input.royReadings ?? []).slice(0, royN),
    chessboardReadings: (input.chessboardReadings ?? []).slice(0, chessN),
  };
}

/** A blank form with the suggested numbers and today's date. */
export function newLabInput(args: { serialNo: number; slabNumber: number; today: string }): LabFormInput {
  return {
    sampleDate: args.today,
    serialNo: String(args.serialNo),
    slabNumber: String(args.slabNumber),
    designName: null,
    plainBody: "",
    designTypes: [],
    numberOfBodies: "",
    materials: [],
    royBody: { count: "", materials: [] },
    kreos: emptyVeinType(),
    carrara: { colours: [] },
    vein: emptyVeinType(),
    chessboard: { count: "", materials: [] },
    readings: [],
    royReadings: [],
    chessboardReadings: [],
    attachmentIds: [],
    remarks: "",
  };
}

export { emptyBodyReadings, emptyMaterials };

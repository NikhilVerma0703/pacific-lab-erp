/**
 * Sample Inward / Outward form — one definition, used by React Hook Form in
 * the browser and re-run by the server action before anything is written.
 *
 *   1 Sample Details — Date, S.No., Slab Number, Company Name, Design Name
 *   2 Design Type and Bodies — Plain Body – Yes / No; with No, the design
 *     types (Roy Body, Kreos, Carrara, Vein, Chessboard), each with its own
 *     fields; Number of Bodies (N), once, shared by every type
 *   3 L, a, b Measurements — Body 1 … N, plus Roy Body 1 … n and Chessboard
 *     Body 1 … n when those types are selected (one L, a, b reading each)
 *   4 Sample Output — files
 *   5 Remarks
 *
 * Nothing is mandatory; what is typed must make sense. Only what the form
 * shows is validated and saved (`visibleInwardInput`).
 */
import { z } from "zod";
import { countOf, designLayout, emptyVeinType, veinTypeSchema, visibleVeinType } from "@/modules/forms/design";
import { DESIGN_TYPE_KEYS } from "@/modules/forms/design-types";
import {
  colourQuantitiesSchema,
  emptyLabReading,
  labReadingSchema,
  masterRefSchema,
  MAX_BODIES,
  optionalDate,
  optionalNumber,
  optionalText,
  yesNoSchema,
} from "@/modules/forms/fields";

const readings = z.array(labReadingSchema).max(MAX_BODIES);

export const inwardFormSchema = z.object({
  // 1 · Sample Details
  entryDate: optionalDate(),
  serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "S.No." }),
  slabNumber: optionalNumber({ min: 1, max: 999_999_999, int: true, label: "Slab Number" }),
  company: masterRefSchema.nullable(),
  /** Design Name — from the Design Names list, or a new name typed via Other…. */
  designName: masterRefSchema.nullable(),

  // 2 · Design Type and Bodies
  /** Plain Body – Yes (true) / No (false). */
  plainBody: yesNoSchema,
  /** Plain Body – No: the selected design types. */
  designTypes: z.array(z.enum(DESIGN_TYPE_KEYS)).max(DESIGN_TYPE_KEYS.length),
  /** Number of Bodies (N) — once, shared by every design type. */
  numberOfBodies: countOf("Number of Bodies (N)"),
  royBody: z.object({ count: countOf("Number of Roy Body (n)") }),
  kreos: veinTypeSchema,
  carrara: z.object({ colours: colourQuantitiesSchema }),
  vein: veinTypeSchema,
  chessboard: z.object({ count: countOf("Number of Chessboard Body (n)") }),

  // 3 · L, a, b Measurements — one reading per body
  bodies: readings,
  royBodies: readings,
  chessboardBodies: readings,

  // 4 · Sample Output, 5 · Remarks
  attachmentIds: z.array(z.string().min(1)).max(10, "At most 10 files per sample."),
  remarks: optionalText(4000),
});

/** What the browser holds (strings). */
export type InwardFormInput = z.input<typeof inwardFormSchema>;
/** What the server writes (numbers / nulls). */
export type InwardFormData = z.output<typeof inwardFormSchema>;
export { emptyVeinType };

/** What the form shows, from the answers so far (shared by the form and the save). */
export const inwardLayout = designLayout;

/**
 * The entry as the form shows it: Plain Body – Yes drops the design types;
 * a type that is not selected drops its fields; Vein Present – No drops
 * Mixer Type, Vein Details and colours; only Body 1 … N, Roy Body 1 … n and
 * Chessboard Body 1 … n are kept. Hidden values are neither validated nor
 * saved — they stay in the form, so switching back brings them back.
 */
export function visibleInwardInput(input: InwardFormInput): InwardFormInput {
  const { types, has, showBodies, n, royN, chessN } = inwardLayout(input);
  return {
    ...input,
    designTypes: types,
    numberOfBodies: showBodies ? input.numberOfBodies : "",
    royBody: has("ROY_BODY") ? input.royBody : { count: "" },
    kreos: visibleVeinType(input.kreos, has("KREOS")),
    carrara: has("CARRARA") ? input.carrara : { colours: [] },
    vein: visibleVeinType(input.vein, has("VEIN")),
    chessboard: has("CHESSBOARD") ? input.chessboard : { count: "" },
    bodies: (input.bodies ?? []).slice(0, n),
    royBodies: (input.royBodies ?? []).slice(0, royN),
    chessboardBodies: (input.chessboardBodies ?? []).slice(0, chessN),
  };
}

/** A blank form with the suggested numbers and today's date. */
export function newInwardInput(args: { serialNo: number; slabNumber: number; today: string }): InwardFormInput {
  return {
    entryDate: args.today,
    serialNo: String(args.serialNo),
    slabNumber: String(args.slabNumber),
    company: null,
    designName: null,
    plainBody: "",
    designTypes: [],
    numberOfBodies: "",
    royBody: { count: "" },
    kreos: emptyVeinType(),
    carrara: { colours: [] },
    vein: emptyVeinType(),
    chessboard: { count: "" },
    bodies: [],
    royBodies: [],
    chessboardBodies: [],
    attachmentIds: [],
    remarks: "",
  };
}

export { emptyLabReading };

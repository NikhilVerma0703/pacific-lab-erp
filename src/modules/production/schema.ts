/**
 * Production Sample form — one definition, used by React Hook Form in the
 * browser and re-run by the server action before anything is written.
 *
 *   1 Basic Information — Date, S.No., Slab Number, Design Name, Number of Bodies (N)
 *   2 L, a, b Measurements — Body 1 … N, each Post Press and Post Polish (L, a, b)
 *   3 Sample Output — files
 *   4 Remarks
 *
 * Nothing is mandatory; what is typed must make sense.
 */
import { z } from "zod";
import {
  bodyCount,
  bodyReadingsSchema,
  emptyBodyReadings,
  masterRefSchema,
  MAX_BODIES,
  optionalDate,
  optionalNumber,
  optionalText,
} from "@/modules/forms/fields";

export const productionFormSchema = z.object({
  sampleDate: optionalDate(),
  serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "S.No." }),
  slabNumber: optionalNumber({ min: 1, max: 999_999_999, int: true, label: "Slab Number" }),
  /** Design Name — from the Design Names list, or a new name typed via Other…. */
  designName: masterRefSchema.nullable(),
  numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies (N)" }),
  /** Body 1 … N — Post Press and Post Polish L, a, b. */
  bodies: z.array(bodyReadingsSchema).max(MAX_BODIES),
  attachmentIds: z.array(z.string().min(1)).max(10, "At most 10 files per sample."),
  remarks: optionalText(4000),
});

/** What the browser holds (strings). */
export type ProductionFormInput = z.input<typeof productionFormSchema>;
/** What the server writes (numbers / nulls). */
export type ProductionFormData = z.output<typeof productionFormSchema>;

/**
 * The entry as the form shows it: only Body 1 … N. Readings of bodies above N
 * (kept in the form while N was lowered) are neither validated nor saved.
 */
export function visibleProductionInput(input: ProductionFormInput): ProductionFormInput {
  return { ...input, bodies: (input.bodies ?? []).slice(0, bodyCount(input.numberOfBodies)) };
}

/** A blank form with the suggested numbers and today's date. */
export function newProductionInput(args: { serialNo: number; slabNumber: number | null; today: string }): ProductionFormInput {
  return {
    sampleDate: args.today,
    serialNo: String(args.serialNo),
    slabNumber: args.slabNumber === null ? "" : String(args.slabNumber),
    designName: null,
    numberOfBodies: "",
    bodies: [],
    attachmentIds: [],
    remarks: "",
  };
}

export { emptyBodyReadings };

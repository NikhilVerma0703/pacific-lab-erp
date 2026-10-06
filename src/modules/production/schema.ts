/**
 * Production Sample form — one definition, used by React Hook Form in the
 * browser and re-run by the server action before anything is written.
 * Reuses the lab-sample building blocks (numbers, L/a/b row, master refs) so
 * the rules are the same in both sections. Nothing is mandatory.
 */
import { z } from "zod";
import {
  designCategorySchema,
  emptyLabRow,
  flagDuplicates,
  labRowSchema,
  masterRefSchema,
  MAX_BODIES,
  optionalNumber,
} from "@/modules/samples/schema";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null));

const labRows = z.array(labRowSchema).max(MAX_BODIES);

/** Roy Body of a production sample: its own Number of Bodies and L/a/b. */
export const productionRoyBodySchema = z
  .object({
    numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies" }),
    postPress: labRows,
    postPolish: labRows,
  })
  .superRefine((v, ctx) => {
    if (v.numberOfBodies !== null && (v.postPress.length > v.numberOfBodies || v.postPolish.length > v.numberOfBodies)) {
      ctx.addIssue({ code: "custom", path: ["numberOfBodies"], message: "More L/a/b rows than bodies." });
    }
  });

/** Body 1 … n of a production sample: its Design (with the Roy Body it may open) and its L, a, b. */
export const productionBodySchema = z
  .object({
    designCategory: designCategorySchema,
    designPatterns: z.array(masterRefSchema).max(30),
    designRoyBody: productionRoyBodySchema,
    postPress: labRowSchema,
    postPolish: labRowSchema,
  })
  .superRefine((v, ctx) => flagDuplicates(ctx, v.designPatterns, ["designPatterns"]));

export const productionFormSchema = z
  .object({
    sampleDate: z
      .string()
      .optional()
      .transform((s, ctx) => {
        if (!s) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date." });
          return z.NEVER;
        }
        return s;
      }),
    serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "S. No." }),
    slabNumber: optionalNumber({ min: 1, max: 999_999_999, int: true, label: "Slab Number" }),
    designName: optionalText(200),
    numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies" }),
    /** Body 1 … n — one section per body. */
    bodies: z.array(productionBodySchema).max(MAX_BODIES),
    attachmentIds: z.array(z.string().min(1)).max(10, "At most 10 files per sample."),
    remarks: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.numberOfBodies !== null && v.bodies.length > v.numberOfBodies) {
      ctx.addIssue({ code: "custom", path: ["numberOfBodies"], message: "More body sections than bodies." });
    }
  });

/** What the browser holds (strings). */
export type ProductionFormInput = z.input<typeof productionFormSchema>;
/** What the server writes (numbers / nulls). */
export type ProductionFormData = z.output<typeof productionFormSchema>;
export type ProductionRoyBodyInput = z.input<typeof productionRoyBodySchema>;
export type ProductionBodyInput = z.input<typeof productionBodySchema>;
export type ProductionBodyData = z.output<typeof productionBodySchema>;

export const emptyProductionRoyBody = (): ProductionRoyBodyInput => ({ numberOfBodies: "", postPress: [], postPolish: [] });

export const emptyProductionBody = (): ProductionBodyInput => ({
  designCategory: "",
  designPatterns: [],
  designRoyBody: emptyProductionRoyBody(),
  postPress: emptyLabRow(),
  postPolish: emptyLabRow(),
});

/** A blank form with the suggested numbers and today's date. */
export function newProductionInput(args: { serialNo: number; slabNumber: number; today: string }): ProductionFormInput {
  return {
    sampleDate: args.today,
    serialNo: String(args.serialNo),
    slabNumber: String(args.slabNumber),
    designName: "",
    numberOfBodies: "",
    bodies: [],
    attachmentIds: [],
    remarks: "",
  };
}

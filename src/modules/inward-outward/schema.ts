/**
 * Inward / Outward entry form — shared by the browser and the server action.
 * Reuses the lab-sample building blocks (formulation, L/a/b row, master refs)
 * so the rules are identical in both sections. Nothing is mandatory.
 */
import { z } from "zod";
import {
  designCategorySchema,
  emptyLabRow,
  emptyRoyBody,
  flagDuplicates,
  labRowSchema,
  masterRefSchema,
  MAX_BODIES,
  optionalNumber,
  royBodySchema,
} from "@/modules/samples/schema";

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null));

/** Body 1 … n of an inward entry: its Design (with the Roy Body it may open) and its L, a, b. */
export const inwardBodySchema = z
  .object({
    designCategory: designCategorySchema,
    designPatterns: z.array(masterRefSchema).max(30),
    designRoyBody: royBodySchema,
    lab: labRowSchema,
  })
  .superRefine((v, ctx) => flagDuplicates(ctx, v.designPatterns, ["designPatterns"]));

export const inwardFormSchema = z
  .object({
    entryDate: z
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
    serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "Serial Number" }),
    /** The lab sample this physical sample belongs to, if any. */
    labSampleId: z.string().nullable().optional().transform((v) => v || null),
    company: masterRefSchema.nullable(),
    /** Sample Design Name — from the Design Names list, or a new name typed via Other…. */
    sampleDesignName: masterRefSchema.nullable(),
    numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies" }),
    /** Body 1 … n — one section per body. */
    bodies: z.array(inwardBodySchema).max(MAX_BODIES),
    recreationAttempts: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.numberOfBodies !== null && v.bodies.length > v.numberOfBodies) {
      ctx.addIssue({ code: "custom", path: ["numberOfBodies"], message: "More body sections than bodies." });
    }
  });

export type InwardFormInput = z.input<typeof inwardFormSchema>;
export type InwardFormData = z.output<typeof inwardFormSchema>;
export type InwardBodyInput = z.input<typeof inwardBodySchema>;

export const emptyInwardBody = (): InwardBodyInput => ({
  designCategory: "",
  designPatterns: [],
  designRoyBody: emptyRoyBody(),
  lab: emptyLabRow(),
});

export function newInwardInput(args: { serialNo: number; today: string; labSampleId?: string | null }): InwardFormInput {
  return {
    entryDate: args.today,
    serialNo: String(args.serialNo),
    labSampleId: args.labSampleId ?? null,
    company: null,
    sampleDesignName: null,
    numberOfBodies: "",
    bodies: [],
    recreationAttempts: "",
  };
}

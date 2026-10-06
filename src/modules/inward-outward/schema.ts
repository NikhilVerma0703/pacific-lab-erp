/**
 * Inward / Outward entry form — shared by the browser and the server action.
 * Reuses the lab-sample building blocks (formulation, L/a/b row, master refs)
 * so the rules are identical in both sections. Nothing is mandatory.
 */
import { z } from "zod";
import {
  emptyRoyBody,
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
    /** The Inspired lab sample this physical sample belongs to, if any. */
    labSampleId: z.string().nullable().optional().transform((v) => v || null),
    company: masterRefSchema.nullable(),
    sampleDesignName: optionalText(200),
    numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies" }),
    measurements: z.array(labRowSchema).max(MAX_BODIES),
    designCategory: z.enum(["", "PLAIN_BODY", "NON_PLAIN_BODY"]).transform((v) => (v === "" ? null : v)),
    designPatterns: z.array(masterRefSchema).max(30),
    designRoyBody: royBodySchema,
    recreationAttempts: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const r of v.designPatterns) {
      const k = r.id ?? r.label.trim().toLowerCase();
      if (seen.has(k)) {
        ctx.addIssue({ code: "custom", path: ["designPatterns"], message: `“${r.label}” is selected twice.` });
        break;
      }
      seen.add(k);
    }
    if (v.numberOfBodies !== null && v.measurements.length > v.numberOfBodies) {
      ctx.addIssue({ code: "custom", path: ["numberOfBodies"], message: "More L/a/b rows than bodies." });
    }
  });

export type InwardFormInput = z.input<typeof inwardFormSchema>;
export type InwardFormData = z.output<typeof inwardFormSchema>;

export function newInwardInput(args: { serialNo: number; today: string; labSampleId?: string | null }): InwardFormInput {
  return {
    entryDate: args.today,
    serialNo: String(args.serialNo),
    labSampleId: args.labSampleId ?? null,
    company: null,
    sampleDesignName: "",
    numberOfBodies: "",
    measurements: [],
    designCategory: "",
    designPatterns: [],
    designRoyBody: emptyRoyBody(),
    recreationAttempts: "",
  };
}

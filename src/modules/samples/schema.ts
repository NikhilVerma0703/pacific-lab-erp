/**
 * Sample form schema — one definition, used by React Hook Form in the browser
 * and re-run by the server action before anything is written.
 *
 * Form inputs are strings (what <input> gives you); the schema turns them into
 * numbers/nulls. Nothing is mandatory: an empty field is simply "not
 * recorded". What *is* enforced is that whatever was typed makes sense.
 */
import { z } from "zod";
import { MAX_LABEL_LENGTH } from "@/lib/normalize";

export const MAX_BODIES = 20;

// ── helpers ──────────────────────────────────────────────────────────────────

export function optionalNumber(opts: { min?: number; max?: number; int?: boolean; label: string }) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim().replace(/,/g, "");
      if (s === "") return null;
      if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be a number.` });
        return z.NEVER;
      }
      const n = Number(s);
      if (opts.int && !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be a whole number.` });
        return z.NEVER;
      }
      if (opts.min !== undefined && n < opts.min) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be at least ${opts.min}.` });
        return z.NEVER;
      }
      if (opts.max !== undefined && n > opts.max) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be at most ${opts.max}.` });
        return z.NEVER;
      }
      return n;
    });
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null));

export const masterRefSchema = z.object({
  id: z.string().optional(),
  label: z.string().max(MAX_LABEL_LENGTH, `Keep values under ${MAX_LABEL_LENGTH} characters.`),
  save: z.boolean().optional(),
});

const unitSchema = z.enum(["", "GRAMS", "PERCENT"]).transform((u) => (u === "" ? null : u));

// ── formulation (reused for Main Body and every Roy Body) ────────────────────

export const componentRowSchema = z
  .object({
    material: masterRefSchema.nullable(),
    size: masterRefSchema.nullable().optional(),
    unit: unitSchema,
    quantity: optionalNumber({ min: 0, max: 1_000_000, label: "Quantity" }),
  })
  .superRefine((row, ctx) => {
    if (row.unit === "PERCENT" && row.quantity !== null && row.quantity > 100) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "A percentage cannot exceed 100." });
    }
  });

export const formulationSchema = z.object({
  resins: z.array(componentRowSchema).max(20),
  grits: z.array(componentRowSchema).max(20),
  fillers: z.array(componentRowSchema).max(20),
  pigments: z.array(componentRowSchema).max(100),
});

// ── L / a / b ────────────────────────────────────────────────────────────────

export const labRowSchema = z.object({
  l: optionalNumber({ min: 0, max: 100, label: "L" }),
  a: optionalNumber({ min: -128, max: 128, label: "a" }),
  b: optionalNumber({ min: -128, max: 128, label: "b" }),
});

// ── the sample ───────────────────────────────────────────────────────────────

export const sampleFormSchema = z
  .object({
    serialNo: optionalNumber({ min: 1, max: 99_999_999, int: true, label: "S.No." }),
    slabNumber: optionalNumber({ min: 1, max: 999_999_999, int: true, label: "Slab Number" }),
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
    sampleType: masterRefSchema.nullable(),
    /** Inspired samples only. */
    physicalSamplePresent: z
      .enum(["", "YES", "NO"])
      .optional()
      .transform((v) => (!v ? null : v === "YES")),
    numberOfBodies: optionalNumber({ min: 1, max: MAX_BODIES, int: true, label: "Number of Bodies" }),
    main: formulationSchema,
    designCategory: z
      .enum(["", "PLAIN_BODY", "NON_PLAIN_BODY"])
      .transform((v) => (v === "" ? null : v)),
    designPatterns: z.array(masterRefSchema).max(30),
    designRoyBody: formulationSchema,
    mixerType: masterRefSchema.nullable(),
    hasVein: z.enum(["", "YES", "NO"]).transform((v) => (v === "" ? null : v === "YES")),
    veinMethods: z.array(masterRefSchema).max(30),
    veinNotes: optionalText(1000),
    veinRoyBody: formulationSchema,
    postPress: z.array(labRowSchema).max(MAX_BODIES),
    postPolish: z.array(labRowSchema).max(MAX_BODIES),
    attachmentIds: z.array(z.string().min(1)).max(10, "At most 10 files per sample."),
    remarks: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    const dupes = (list: { id?: string; label: string }[], path: string) => {
      const seen = new Set<string>();
      for (const r of list) {
        const k = r.id ?? r.label.trim().toLowerCase();
        if (seen.has(k)) {
          ctx.addIssue({ code: "custom", path: [path], message: `“${r.label}” is selected twice.` });
          return;
        }
        seen.add(k);
      }
    };
    dupes(v.designPatterns, "designPatterns");
    dupes(v.veinMethods, "veinMethods");
    if (v.numberOfBodies !== null) {
      if (v.postPress.length > v.numberOfBodies || v.postPolish.length > v.numberOfBodies) {
        ctx.addIssue({ code: "custom", path: ["numberOfBodies"], message: "More L/a/b rows than bodies." });
      }
    }
  });

/** What the browser holds (strings). */
export type SampleFormInput = z.input<typeof sampleFormSchema>;
/** What the server writes (numbers / nulls). */
export type SampleFormData = z.output<typeof sampleFormSchema>;
export type FormulationInput = z.input<typeof formulationSchema>;
export type FormulationData = z.output<typeof formulationSchema>;
export type ComponentRowInput = z.input<typeof componentRowSchema>;
export type LabRowInput = z.input<typeof labRowSchema>;

export const emptyComponentRow = (): ComponentRowInput => ({ material: null, size: null, unit: "", quantity: "" });

export const emptyFormulation = (): FormulationInput => ({
  resins: [emptyComponentRow()],
  grits: [emptyComponentRow()],
  fillers: [emptyComponentRow()],
  pigments: [],
});

export const emptyLabRow = (): LabRowInput => ({ l: "", a: "", b: "" });

/** A blank sample form with the suggested numbers and today's date. */
export function newSampleInput(args: { serialNo: number; slabNumber: number; today: string }): SampleFormInput {
  return {
    serialNo: String(args.serialNo),
    slabNumber: String(args.slabNumber),
    sampleDate: args.today,
    sampleType: null,
    physicalSamplePresent: "",
    numberOfBodies: "",
    main: emptyFormulation(),
    designCategory: "",
    designPatterns: [],
    designRoyBody: emptyFormulation(),
    mixerType: null,
    hasVein: "",
    veinMethods: [],
    veinNotes: "",
    veinRoyBody: emptyFormulation(),
    postPress: [],
    postPolish: [],
    attachmentIds: [],
    remarks: "",
  };
}

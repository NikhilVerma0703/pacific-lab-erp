/**
 * Building blocks for the data-entry forms (rebuilt one by one, starting with
 * Production Sample). Pure Zod definitions — used by React Hook Form in the
 * browser and re-run by the server action before anything is written.
 *
 * Form inputs are strings (what <input> gives you); these turn them into
 * numbers / nulls. Nothing is mandatory unless a form says so: an empty field
 * is simply "not recorded". What is enforced is that whatever was typed makes
 * sense.
 */
import { z } from "zod";
import { MAX_LABEL_LENGTH, normalizeKey } from "@/lib/normalize";
import { labelLimit, MASTER } from "@/modules/master-data/catalog";

/** Most bodies a record can have. */
export const MAX_BODIES = 20;

/** A number typed as text; empty → null. */
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

/** Free text; blank → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null));

/** A date from <input type="date"> (YYYY-MM-DD); blank → null. */
export const optionalDate = () =>
  z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date." });
        return z.NEVER;
      }
      return s;
    });

/** A value picked from a master list, or typed as new ("Other…"); `max` is the list's longest value. */
export const masterRefOf = (max: number) =>
  z.object({
    id: z.string().optional(),
    label: z.string().max(max, `Keep values under ${max} characters.`),
    save: z.boolean().optional(),
  });

export const masterRefSchema = masterRefOf(MAX_LABEL_LENGTH);

/** Yes / No buttons; "" = not answered → null. */
export const yesNoSchema = z.enum(["", "YES", "NO"]).transform((v) => (v === "" ? null : v === "YES"));
export type YesNoInput = z.input<typeof yesNoSchema>;

/** A list value picked twice (same name ignoring case / spaces) → one issue on `path`. */
export function flagDuplicates(ctx: z.RefinementCtx, labels: string[], path: (string | number)[]) {
  const seen = new Set<string>();
  for (const label of labels) {
    const k = normalizeKey(label);
    if (seen.has(k)) {
      ctx.addIssue({ code: "custom", path, message: `“${label}” is selected twice.` });
      return;
    }
    seen.add(k);
  }
}

/** Vein Details — values of the Vein Details list (several may be picked). */
export const veinDetailsSchema = z
  .array(masterRefOf(labelLimit(MASTER.VEIN_DETAIL)))
  .max(30)
  .superRefine((list, ctx) => flagDuplicates(ctx, list.map((v) => v.label), []));

/** Colours used (Pigments / Colours list), each with its Quantity (gm). */
export const colourQuantitiesSchema = z
  .array(
    z.object({
      colour: masterRefSchema,
      quantity: optionalNumber({ min: 0, max: 1_000_000, label: "Quantity (gm)" }),
    }),
  )
  .max(30)
  .superRefine((list, ctx) => flagDuplicates(ctx, list.map((c) => c.colour.label), []));
export type ColourQuantityInput = z.input<typeof colourQuantitiesSchema>[number];

/** One L, a, b reading: L 0–100, a and b −128…128. */
export const labReadingSchema = z.object({
  l: optionalNumber({ min: 0, max: 100, label: "L" }),
  a: optionalNumber({ min: -128, max: 128, label: "a" }),
  b: optionalNumber({ min: -128, max: 128, label: "b" }),
});
export type LabReadingInput = z.input<typeof labReadingSchema>;
export type LabReadingData = z.output<typeof labReadingSchema>;
export const emptyLabReading = (): LabReadingInput => ({ l: "", a: "", b: "" });
export const readingIsEmpty = (r: LabReadingData) => r.l === null && r.a === null && r.b === null;

/** One body's readings: Post Press and Post Polish, each L, a, b. */
export const bodyReadingsSchema = z.object({
  postPress: labReadingSchema,
  postPolish: labReadingSchema,
});
export type BodyReadingsInput = z.input<typeof bodyReadingsSchema>;
export const emptyBodyReadings = (): BodyReadingsInput => ({ postPress: emptyLabReading(), postPolish: emptyLabReading() });

/**
 * How many body sections Number of Bodies (N) asks for: a whole number
 * 1 … MAX_BODIES, otherwise 0 (blank or not yet valid).
 */
export function bodyCount(raw: unknown): number {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return 0;
  const n = Number(s);
  return n >= 1 && n <= MAX_BODIES ? n : 0;
}

/** Validation issues → { "dotted.path": "first message" }, for highlighting fields after a server check. */
export function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

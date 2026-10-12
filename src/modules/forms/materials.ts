/**
 * Material Details of one body (Lab Sample form): what went into it.
 *
 *   Material Choices
 *     Resin   — resin (Resins list) + Quantity (gm)
 *     Grits   — grit (Grits list) + Size of Grit (Grit Sizes list) + Quantity (gm)
 *     Filler  — filler (Fillers list) + Quantity (gm)
 *   Pigments / Additives Details
 *     Pigments  — Color Used (several, Pigments / Colours list) + Quantity (gm) each
 *     Additives — Additives Used (several, Additives list) + Quantity (gm) each
 *
 * Resin, Grits and Filler take one or more rows. Every list value can be
 * typed when it is not on the list yet; saving adds it for later entries
 * (same name in another letter case = the same value). Pure Zod — shared by
 * the browser and the server.
 */
import { z } from "zod";
import { normalizeKey } from "@/lib/normalize";
import { flagDuplicates, masterRefSchema, optionalNumber } from "./fields";

const quantity = optionalNumber({ min: 0, max: 1_000_000, label: "Quantity (gm)" });

/**
 * Unit of a quantity. Grams for everything entered now; "PERCENT" survives on
 * a few rows recorded by an early version of the lab form and is kept as is.
 */
const unitSchema = z
  .enum(["", "GRAMS", "PERCENT"])
  .optional()
  .transform((u) => (u ? u : null));

const percentAtMost100 = (row: { unit: string | null; quantity: number | null }, ctx: z.RefinementCtx) => {
  if (row.unit === "PERCENT" && row.quantity !== null && row.quantity > 100) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "A percentage must be at most 100." });
  }
};

const materialRow = z
  .object({ material: masterRefSchema.nullable(), quantity, unit: unitSchema })
  .superRefine((row, ctx) => percentAtMost100(row, ctx));
const gritRow = z
  .object({ material: masterRefSchema.nullable(), size: masterRefSchema.nullable(), quantity, unit: unitSchema })
  .superRefine((row, ctx) => percentAtMost100(row, ctx));

const filled = (r: { label: string } | null | undefined): r is { label: string } => !!r && r.label.trim() !== "";

/** Resin / Filler rows: a quantity needs its material; the same material twice is flagged. */
const materialRows = (noun: string) =>
  z
    .array(materialRow)
    .max(20)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        if (!filled(r.material)) {
          if (r.quantity !== null) ctx.addIssue({ code: "custom", path: [i, "material"], message: `Select the ${noun} for this quantity.` });
          return;
        }
        const k = normalizeKey(r.material.label);
        if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "material"], message: `“${r.material.label}” is entered twice.` });
        seen.add(k);
      });
    });

/** Grit rows: size or quantity need a grit; the same grit and size twice is flagged. */
const gritRows = z
  .array(gritRow)
  .max(20)
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (!filled(r.material)) {
        if (r.quantity !== null || filled(r.size)) ctx.addIssue({ code: "custom", path: [i, "material"], message: "Select the grit for this size / quantity." });
        return;
      }
      const k = `${normalizeKey(r.material.label)}|${filled(r.size) ? normalizeKey(r.size.label) : ""}`;
      if (seen.has(k)) {
        ctx.addIssue({ code: "custom", path: [i, "material"], message: `“${r.material.label}”${filled(r.size) ? ` (${r.size.label})` : ""} is entered twice.` });
      }
      seen.add(k);
    });
  });

/** Pigments / Additives: several values, each with its Quantity (gm). */
const pickedWithQuantity = z
  .array(z.object({ colour: masterRefSchema, quantity, unit: unitSchema }).superRefine((row, ctx) => percentAtMost100(row, ctx)))
  .max(30)
  .superRefine((list, ctx) => flagDuplicates(ctx, list.map((c) => c.colour.label), []));

export const materialsSchema = z.object({
  resins: materialRows("resin"),
  grits: gritRows,
  fillers: materialRows("filler"),
  /** Color Used — Pigments / Colours list. */
  pigments: pickedWithQuantity,
  /** Additives Used — Additives list (rows use the same { colour, quantity } shape). */
  additives: pickedWithQuantity,
});

export type MaterialsInput = z.input<typeof materialsSchema>;
export type MaterialsData = z.output<typeof materialsSchema>;
export type MaterialRowInput = MaterialsInput["resins"][number];
export type GritRowInput = MaterialsInput["grits"][number];

export const emptyMaterialRow = (): MaterialRowInput => ({ material: null, quantity: "", unit: "" });
export const emptyGritRow = (): GritRowInput => ({ material: null, size: null, quantity: "", unit: "" });

/** A body's Material Details before anything is entered: one Resin, Grits and Filler row. */
export const emptyMaterials = (): MaterialsInput => ({
  resins: [emptyMaterialRow()],
  grits: [emptyGritRow()],
  fillers: [emptyMaterialRow()],
  pigments: [],
  additives: [],
});

/** Nothing entered for this body? */
export function materialsAreEmpty(m: MaterialsData): boolean {
  return (
    m.resins.every((r) => !filled(r.material)) &&
    m.grits.every((r) => !filled(r.material)) &&
    m.fillers.every((r) => !filled(r.material)) &&
    m.pigments.length === 0 &&
    m.additives.length === 0
  );
}

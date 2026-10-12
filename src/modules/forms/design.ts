/**
 * Design Type and Bodies — the part the Lab Sample and Inward / Outward forms
 * share: Plain Body – Yes / No, the design types (Plain Body – No), Number of
 * Bodies (N) once for all of them, and Number of Roy Body / Chessboard Body (n).
 *
 * Pure — used by the browser (what to show), the server (what to save) and
 * the tests.
 */
import { z } from "zod";
import { bodyCount, colourQuantitiesSchema, masterRefSchema, optionalNumber, MAX_BODIES, veinDetailsSchema, yesNoSchema, type YesNoInput } from "./fields";
import { orderTypes, type DesignTypeKey } from "./design-types";

/** A whole number 1–20 (Number of Bodies / Number of Roy Body …). */
export const countOf = (label: string) => optionalNumber({ min: 1, max: MAX_BODIES, int: true, label });

/** Kreos / Vein: Vein Present – Yes / No; with Yes, Mixer Type, Vein Details and the colours used. */
export const veinTypeSchema = z.object({
  veinPresent: yesNoSchema,
  mixerType: masterRefSchema.nullable(),
  veinDetails: veinDetailsSchema,
  colours: colourQuantitiesSchema,
});
export type VeinTypeInput = z.input<typeof veinTypeSchema>;
export type VeinTypeData = z.output<typeof veinTypeSchema>;

export const emptyVeinType = (): VeinTypeInput => ({ veinPresent: "", mixerType: null, veinDetails: [], colours: [] });

/** Kreos / Vein as the form shows it: Vein Present – No (or not answered) drops the vein fields. */
export const visibleVeinType = (v: VeinTypeInput, selected: boolean): VeinTypeInput =>
  !selected ? emptyVeinType() : v.veinPresent === "YES" ? v : { ...emptyVeinType(), veinPresent: v.veinPresent };

export interface DesignAnswers {
  plainBody: YesNoInput;
  designTypes?: readonly string[];
  numberOfBodies?: unknown;
  royBody?: { count?: unknown };
  chessboard?: { count?: unknown };
}

/** What the form shows, from the answers so far (shared by the form and the save). */
export function designLayout(v: DesignAnswers) {
  const types: DesignTypeKey[] = v.plainBody === "NO" ? orderTypes(v.designTypes ?? []) : [];
  const has = (k: DesignTypeKey) => types.includes(k);
  // N appears once a design is chosen: Plain Body – Yes, or No with at least one type.
  const showBodies = v.plainBody === "YES" || types.length > 0;
  return {
    types,
    has,
    showBodies,
    n: showBodies ? bodyCount(v.numberOfBodies) : 0,
    royN: has("ROY_BODY") ? bodyCount(v.royBody?.count) : 0,
    chessN: has("CHESSBOARD") ? bodyCount(v.chessboard?.count) : 0,
  };
}
export type DesignLayout = ReturnType<typeof designLayout>;

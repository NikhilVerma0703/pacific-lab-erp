/**
 * Plain Body – No: the design types a lab sample or an Inward / Outward entry
 * can carry, in the order the forms show them, and what each one asks for.
 *
 * Each type is also a value of the Design Patterns list (matched by its code,
 * else by name), so it counts as a design pattern for the Dashboard and
 * Downloads. Pure — shared by the browser, the server and the tests.
 */
import { normalizeKey } from "@/lib/normalize";
import { VALUE_CODE } from "@/modules/master-data/catalog";

export const DESIGN_TYPES = [
  { key: "ROY_BODY", label: "Roy Body", code: VALUE_CODE.ROY_BODY, patternLabel: "ROY BODY", special: { countLabel: "Number of Roy Body (n)", bodyLabel: "Roy Body", groupLabel: "Roy Bodies" } },
  { key: "KREOS", label: "Kreos", code: VALUE_CODE.KREOS, patternLabel: "KREOS", special: null },
  { key: "CARRARA", label: "Carrara", code: VALUE_CODE.CARRARA, patternLabel: "CARRARA", special: null },
  { key: "VEIN", label: "Vein", code: VALUE_CODE.VEIN, patternLabel: "VEIN", special: null },
  { key: "CHESSBOARD", label: "Chessboard", code: VALUE_CODE.CHESSBOARD, patternLabel: "CHESSBOARD", special: { countLabel: "Number of Chessboard Body (n)", bodyLabel: "Chessboard Body", groupLabel: "Chessboard Bodies" } },
] as const;

export type DesignTypeKey = (typeof DESIGN_TYPES)[number]["key"];
export const DESIGN_TYPE_KEYS = DESIGN_TYPES.map((t) => t.key) as [DesignTypeKey, ...DesignTypeKey[]];

export const designType = (key: DesignTypeKey) => DESIGN_TYPES.find((t) => t.key === key)!;

/**
 * The design type a Design Patterns value stands for (by its code, else by its
 * name), or null for any other pattern (e.g. one recorded by an earlier form).
 */
export function typeOfPattern(p: { code?: string | null; label: string }): DesignTypeKey | null {
  return DESIGN_TYPES.find((t) => (p.code ? p.code === t.code : false) || normalizeKey(p.label) === normalizeKey(t.patternLabel))?.key ?? null;
}

/** The selected types, each once, in the form's order. */
export const orderTypes = (keys: readonly string[]): DesignTypeKey[] => DESIGN_TYPES.map((t) => t.key).filter((k) => keys.includes(k));

/** "Plain Body" / "Roy Body, Carrara" / "Non-Plain Body" — an entry's design in a few words. */
export function designSummary(plainBody: boolean | null, types: readonly DesignTypeKey[]): string {
  if (plainBody === true) return "Plain Body";
  if (plainBody === false) return types.length ? orderTypes(types).map((k) => designType(k).label).join(", ") : "Non-Plain Body";
  return "";
}

/**
 * The master lists the Lab ERP ships with, and the codes the application reacts
 * to. Adding a new list later = a new entry here (for seeding) or a row in
 * MasterCategory — no schema change.
 *
 * Shared by the seed script, the server and the client, so it must stay free of
 * server-only imports.
 */
import { MAX_LABEL_LENGTH } from "../../lib/normalize";

export const MASTER = {
  RESIN: "RESIN",
  GRIT: "GRIT",
  GRIT_SIZE: "GRIT_SIZE",
  FILLER: "FILLER",
  PIGMENT: "PIGMENT",
  ADDITIVE: "ADDITIVE",
  DESIGN_PATTERN: "DESIGN_PATTERN",
  DESIGN_NAME: "DESIGN_NAME",
  MIXER_TYPE: "MIXER_TYPE",
  VEIN_METHOD: "VEIN_METHOD",
  VEIN_DETAIL: "VEIN_DETAIL",
  COMPANY: "COMPANY",
} as const;

export type MasterCode = (typeof MASTER)[keyof typeof MASTER];

/** Value codes with behaviour attached. */
export const VALUE_CODE = {
  ROY_BODY: "ROY_BODY",
  // Design types of the Inward / Outward form (Plain Body – No).
  KREOS: "KREOS",
  CARRARA: "CARRARA",
  VEIN: "VEIN",
  CHESSBOARD: "CHESSBOARD",
} as const;

/**
 * Lists the ERP no longer uses. Hidden from Master Data; the seed script
 * removes them once nothing refers to them. (Sample Types — Creative /
 * Inspired — were retired when Sample Type was removed from Sample Data Entry.)
 */
export const RETIRED_CATEGORY_CODES = ["SAMPLE_TYPE"] as const;

export interface CatalogEntry {
  code: MasterCode;
  name: string;
  description: string;
  values: Array<{ label: string; code?: string }>;
  /** Position in Master Data; defaults to the entry's place in CATALOG. */
  sortOrder?: number;
  /** Longest value allowed (default MAX_LABEL_LENGTH). */
  maxLabel?: number;
}

/** Where a list sits in Master Data. */
export const catalogSortOrder = (entry: CatalogEntry, index: number) => entry.sortOrder ?? (index + 1) * 10;

// Resins, Grits, Grit Sizes and Fillers start empty: the Lab Sample form lets
// people type them, and each new value becomes an option for later entries.
export const CATALOG: CatalogEntry[] = [
  {
    code: MASTER.RESIN,
    name: "Resins",
    description: "Resin suppliers / grades used in formulations.",
    values: [],
  },
  {
    code: MASTER.GRIT,
    name: "Grits",
    description: "Grit materials.",
    values: [],
  },
  {
    code: MASTER.GRIT_SIZE,
    name: "Grit Sizes",
    description: "Particle size ranges for grits.",
    values: [],
  },
  {
    code: MASTER.FILLER,
    name: "Fillers",
    description: "Filler materials.",
    values: [],
  },
  {
    code: MASTER.PIGMENT,
    name: "Pigments / Colours",
    description: "Every colour used in a sample. Grows with use.",
    values: [{ label: "White" }, { label: "Grey" }, { label: "Black" }],
  },
  {
    code: MASTER.ADDITIVE,
    name: "Additives",
    description: "Additives used in formulations (Lab Sample form). Grows with use.",
    values: [],
    // Right after Pigments / Colours, also on installs that already have the other lists.
    sortOrder: 55,
  },
  {
    code: MASTER.DESIGN_PATTERN,
    name: "Design Patterns",
    description: "Non-plain body design patterns. ROY BODY opens the Roy Body formulation.",
    values: [
      { label: "CARRARA", code: VALUE_CODE.CARRARA },
      { label: "VEIN", code: VALUE_CODE.VEIN },
      { label: "KREOS", code: VALUE_CODE.KREOS },
      { label: "CHESSBOARD", code: VALUE_CODE.CHESSBOARD },
      { label: "ROY BODY", code: VALUE_CODE.ROY_BODY },
    ],
  },
  {
    code: MASTER.DESIGN_NAME,
    name: "Design Names",
    description: "Design names used in Sample Data Entry, Production Sample and Inward / Outward. Grows with use.",
    values: [],
    // Right after Design Patterns, also on installs that already have the other lists.
    sortOrder: 65,
  },
  {
    code: MASTER.MIXER_TYPE,
    name: "Mixer Types",
    description: "Mixer used to prepare the sample.",
    values: [{ label: "GRIT" }, { label: "FILLER" }, { label: "PURE" }],
  },
  {
    code: MASTER.VEIN_METHOD,
    name: "Vein Introduction Methods",
    description: "How the vein was introduced. ROY BODY opens the Roy Body formulation.",
    values: [
      { label: "CARRARA" },
      { label: "KREOS" },
      { label: "ROY BODY", code: VALUE_CODE.ROY_BODY },
      { label: "VEIN" },
    ],
  },
  {
    code: MASTER.VEIN_DETAIL,
    name: "Vein Details",
    description: "Vein details (colour, thickness, direction …) — picked like Color Used. Grows with use.",
    values: [],
    // Right after Vein Introduction Methods, also on installs that already have the other lists.
    sortOrder: 95,
    // Details are short phrases rather than one-word names.
    maxLabel: 200,
  },
  {
    code: MASTER.COMPANY,
    name: "Companies",
    description: "Companies samples come from or go to (Inward / Outward). Grows with use.",
    values: [],
  },
];

/** Longest value a list accepts. */
export function labelLimit(code: string): number {
  return CATALOG.find((c) => c.code === code)?.maxLabel ?? MAX_LABEL_LENGTH;
}

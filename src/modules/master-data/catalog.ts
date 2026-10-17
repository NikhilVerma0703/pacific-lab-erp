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
 * Inspired — went with Sample Type; Vein Introduction Methods were used only
 * by the earlier forms, whose saved records keep showing them.)
 */
export const RETIRED_CATEGORY_CODES = ["SAMPLE_TYPE", "VEIN_METHOD"] as const;

/**
 * Lists not shown in Master Data: the retired ones, and Vein Details — the
 * Kreos / Vein "Vein Details" field still offers what was typed before, but
 * the list itself is no longer managed in Master Data.
 */
export const HIDDEN_CATEGORY_CODES: readonly string[] = [...RETIRED_CATEGORY_CODES, MASTER.VEIN_DETAIL];

/**
 * Material lists with no predefined values: Resin, Grits, Grit Sizes, Filler,
 * Pigments / Colours (Color Used, and the colours of Kreos / Carrara / Vein)
 * and Additives start empty and hold only what people type in the forms — each
 * field into its own list. Values an earlier version seeded are removed
 * (deleted when unused, else hidden) by `retirePredefinedValues`.
 */
export const TYPED_ONLY_CODES: readonly MasterCode[] = [MASTER.RESIN, MASTER.GRIT, MASTER.GRIT_SIZE, MASTER.FILLER, MASTER.PIGMENT, MASTER.ADDITIVE];

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

// The material lists (TYPED_ONLY_CODES) start empty: the forms let people type
// them, and each new value becomes an option of that field for later entries.
export const CATALOG: CatalogEntry[] = [
  {
    code: MASTER.RESIN,
    name: "Resins",
    description: "Resins typed in the forms. Starts empty; grows with use.",
    values: [],
  },
  {
    code: MASTER.GRIT,
    name: "Grits",
    description: "Grits typed in the forms. Starts empty; grows with use.",
    values: [],
  },
  {
    code: MASTER.GRIT_SIZE,
    name: "Grit Sizes",
    description: "Sizes of grit typed in the forms. Starts empty; grows with use.",
    values: [],
  },
  {
    code: MASTER.FILLER,
    name: "Fillers",
    description: "Fillers typed in the forms. Starts empty; grows with use.",
    values: [],
  },
  {
    code: MASTER.PIGMENT,
    name: "Pigments / Colours",
    description: "Every colour typed in the forms (Color Used, Kreos / Carrara / Vein colours). Starts empty; grows with use.",
    values: [],
  },
  {
    code: MASTER.ADDITIVE,
    name: "Additives",
    description: "Additives typed in the Lab Sample form. Starts empty; grows with use.",
    values: [],
    // Right after Pigments / Colours, also on installs that already have the other lists.
    sortOrder: 55,
  },
  {
    code: MASTER.DESIGN_PATTERN,
    name: "Design Types",
    description: "Design types of Plain Body – No (Roy Body, Kreos, Carrara, Vein, Chessboard), and design patterns recorded by the earlier forms.",
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
    // Right after Design Types, also on installs that already have the other lists.
    sortOrder: 65,
  },
  {
    code: MASTER.MIXER_TYPE,
    name: "Mixer Types",
    description: "Mixer used to prepare the sample.",
    values: [{ label: "GRIT" }, { label: "FILLER" }, { label: "PURE" }],
  },
  {
    code: MASTER.VEIN_DETAIL,
    name: "Vein Details",
    description: "Vein details typed in the Kreos / Vein sections. Not shown in Master Data; grows with use.",
    values: [],
    // Near Mixer Types, also on installs that already have the other lists.
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

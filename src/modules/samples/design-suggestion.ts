/**
 * One saved design of a Design Name in the Sample Inward / Outward Database,
 * offered beside the Lab Sample form's Design Name ("A – Roy Body + Carrara").
 * Pure — shared by the server (built in `inward-link.ts`), the form and tests.
 */
import { emptyLabReading, type BodyReadingsInput } from "@/modules/forms/fields";
import type { DesignTypeKey } from "@/modules/forms/design-types";

type LabValue = { l: string | null; a: string | null; b: string | null } | null;

export interface DesignSuggestion {
  /** Plain Body + design types — one suggestion per design. */
  key: string;
  designName: string;
  /** "Plain Body" · "Roy Body + Carrara" */
  design: string;
  plainBody: boolean | null;
  designTypes: DesignTypeKey[];
  numberOfBodies: number | null;
  royCount: number | null;
  chessCount: number | null;
  /** One L, a, b reading per body (Inward / Outward has no Post Press / Post Polish split). */
  readings: LabValue[];
  royReadings: LabValue[];
  chessboardReadings: LabValue[];
  /** The latest Inward / Outward entry with this design. */
  source: { entryId: string; serialNo: number; slabNumber: number | null; entryDate: string };
  /** How many saved entries have this design. */
  records: number;
}

const str = (v: string | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));

/** An inward reading as a Lab Sample row: Post Press left empty, the reading in Post Polish. */
export function asPostPolish(v: LabValue): BodyReadingsInput {
  return { postPress: emptyLabReading(), postPolish: v ? { l: str(v.l), a: str(v.a), b: str(v.b) } : emptyLabReading() };
}

/** Rows for `n` bodies from the inward readings (missing readings → empty rows). */
export function postPolishRows(list: LabValue[], n: number | null): BodyReadingsInput[] {
  const count = Math.max(n ?? 0, list.length);
  return Array.from({ length: count }, (_, i) => asPostPolish(list[i] ?? null));
}

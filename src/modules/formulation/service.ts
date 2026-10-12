import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Reading formulations back: Material Details of a body (Resin, Grits, Filler,
 * Pigments, Additives) and, for records of the earlier forms, Roy Body
 * details — for the Review pages, the Lab Sample form, Downloads and Reports.
 */
const valueSelect = { select: { id: true, label: true, code: true, isActive: true } } as const;

const componentsInclude = {
  include: { material: valueSelect, size: valueSelect },
  orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
} satisfies Prisma.Formulation$componentsArgs;

/** Prisma include for reading formulations back — Roy Body details and the nested Vein Roy Body too. */
export const formulationInclude = {
  components: componentsInclude,
  additives: { include: { additive: valueSelect }, orderBy: { sortOrder: "asc" } },
  mixerType: valueSelect,
  veinMethods: { include: { method: valueSelect }, orderBy: { sortOrder: "asc" } },
  veinDetails: { include: { detail: valueSelect }, orderBy: { sortOrder: "asc" } },
  measurements: { orderBy: [{ stage: "asc" }, { bodyIndex: "asc" }] },
  children: { include: { components: componentsInclude } },
} satisfies Prisma.FormulationInclude;

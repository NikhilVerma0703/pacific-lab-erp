import type { Prisma } from "@prisma/client";
import { formulationInclude } from "@/modules/formulation/service";

const valueSelect = { select: { id: true, label: true, code: true, isActive: true } } as const;

/** Everything a sample holds — for the Review page, the form, Recent Entries and Downloads. */
export const sampleInclude = {
  mixerType: valueSelect,
  designNameValue: valueSelect,
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  formulations: { include: formulationInclude },
  designPatterns: { include: { pattern: valueSelect }, orderBy: { sortOrder: "asc" } },
  designDetails: {
    include: {
      mixerType: valueSelect,
      veinDetails: { include: { detail: valueSelect }, orderBy: { sortOrder: "asc" } },
      colours: { include: { colour: valueSelect }, orderBy: { sortOrder: "asc" } },
    },
  },
  veinMethods: { include: { method: valueSelect }, orderBy: { sortOrder: "asc" } },
  measurements: { orderBy: [{ part: "asc" }, { stage: "asc" }, { bodyIndex: "asc" }] },
  attachments: { orderBy: { createdAt: "asc" } },
  inwardEntry: { select: { id: true, serialNo: true } },
  bodies: {
    include: {
      mixerType: valueSelect,
      designPatterns: { include: { pattern: valueSelect }, orderBy: { sortOrder: "asc" } },
      veinMethods: { include: { method: valueSelect }, orderBy: { sortOrder: "asc" } },
      veinDetails: { include: { detail: valueSelect }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { bodyIndex: "asc" },
  },
} satisfies Prisma.LabSampleInclude;

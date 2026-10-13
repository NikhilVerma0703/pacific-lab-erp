import type { Prisma } from "@prisma/client";
import { formulationInclude } from "@/modules/formulation/service";

const valueSelect = { select: { id: true, label: true, code: true, isActive: true } } as const;

/** Everything an entry holds — for the Review page, the form, the register and Downloads. */
export const inwardInclude = {
  company: valueSelect,
  designNameValue: valueSelect,
  labSample: { select: { id: true, serialNo: true, slabNumber: true, sampleDate: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  designPatterns: { include: { pattern: valueSelect }, orderBy: { sortOrder: "asc" } },
  designDetails: {
    include: {
      mixerType: valueSelect,
      veinDetails: { include: { detail: valueSelect }, orderBy: { sortOrder: "asc" } },
      colours: { include: { colour: valueSelect }, orderBy: { sortOrder: "asc" } },
    },
  },
  measurements: { orderBy: [{ part: "asc" }, { bodyIndex: "asc" }] },
  formulations: { include: formulationInclude },
  bodies: {
    include: { designPatterns: { include: { pattern: valueSelect }, orderBy: { sortOrder: "asc" } } },
    orderBy: { bodyIndex: "asc" },
  },
  attachments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.InwardOutwardEntryInclude;

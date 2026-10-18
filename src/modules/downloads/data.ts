import "server-only";
import { prisma } from "@/lib/db";
import { cleanLabel, compareLabels, normalizeKey } from "@/lib/normalize";
import { DESIGN_TYPES, PLAIN_BODY_LABEL, typeOfPattern } from "@/modules/forms/design-types";
import { inwardInclude } from "@/modules/inward-outward/include";
import { toInwardDetail, type InwardDetail } from "@/modules/inward-outward/queries";
import { MASTER } from "@/modules/master-data/catalog";
import { productionInclude } from "@/modules/production/service";
import { toProductionDetail, type ProductionDetail } from "@/modules/production/queries";
import { sampleInclude } from "@/modules/samples/include";
import { toDetail, type SampleDetail } from "@/modules/samples/queries";
import type { FilterSource, SampleType } from "./filters";
import { periodWhere, type Period } from "./period";

/**
 * What "Production Date" means per record — each record's own Date field:
 *  - Lab samples → the sample's Date
 *  - Inward / Outward entries → the entry's Date
 *  - Production samples → the production sample's Date
 * Records come oldest date first, then by S.No.
 */
export async function samplesIn(period: Period): Promise<SampleDetail[]> {
  const rows = await prisma.labSample.findMany({
    where: { sampleDate: periodWhere(period) },
    include: sampleInclude,
    orderBy: [{ sampleDate: "asc" }, { serialNo: "asc" }],
  });
  return rows.map(toDetail);
}

export async function inwardIn(period: Period): Promise<InwardDetail[]> {
  const rows = await prisma.inwardOutwardEntry.findMany({
    where: { entryDate: periodWhere(period) },
    include: inwardInclude,
    orderBy: [{ entryDate: "asc" }, { serialNo: "asc" }],
  });
  return rows.map(toInwardDetail);
}

export async function productionIn(period: Period): Promise<ProductionDetail[]> {
  const rows = await prisma.productionSample.findMany({
    where: { sampleDate: periodWhere(period) },
    include: productionInclude,
    orderBy: [{ sampleDate: "asc" }, { serialNo: "asc" }],
  });
  return rows.map(toProductionDetail);
}

/** The records of one Sample Type dated in the period — what Filtered Data Export filters. */
export async function filterSource(type: SampleType, period: Period): Promise<FilterSource> {
  switch (type) {
    case "LAB":
      return { type, samples: await samplesIn(period) };
    case "INWARD":
      return { type, entries: await inwardIn(period) };
    case "PRODUCTION":
      return { type, productions: await productionIn(period) };
  }
}

/** Labels, each once (ignoring case and spaces), A–Z. */
function distinctLabels(labels: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of labels) {
    const label = cleanLabel(raw ?? "");
    if (label && !seen.has(normalizeKey(label))) seen.set(normalizeKey(label), label);
  }
  return [...seen.values()].sort(compareLabels);
}

/**
 * The choices of Filtered Data Export:
 *  - Sample Design: every Design Name saved on a Lab Sample, Inward / Outward
 *    or Production Sample record (including names typed before the list existed);
 *  - Design Type: every design type saved on those records — Plain Body, the
 *    form's design types and the design patterns earlier forms recorded.
 */
export async function filterOptions(): Promise<{ sampleDesigns: string[]; designTypes: string[] }> {
  const usedPattern = { some: {} };
  const [names, labNames, inwardNames, productionNames, patterns, plainLab, plainInward, plainProduction, labTypes, inwardTypes] = await Promise.all([
    prisma.masterValue.findMany({
      where: {
        category: { code: MASTER.DESIGN_NAME },
        OR: [{ samplesAsDesignName: { some: {} } }, { inwardsAsDesignName: { some: {} } }, { productionsAsDesignName: { some: {} } }],
      },
      select: { label: true },
    }),
    prisma.labSample.findMany({ where: { designNameId: null, NOT: { legacyDesignName: null } }, distinct: ["legacyDesignName"], select: { legacyDesignName: true } }),
    prisma.inwardOutwardEntry.findMany({
      where: { designNameId: null, NOT: { legacySampleDesignName: null } },
      distinct: ["legacySampleDesignName"],
      select: { legacySampleDesignName: true },
    }),
    prisma.productionSample.findMany({ where: { designNameId: null, NOT: { legacyDesignName: null } }, distinct: ["legacyDesignName"], select: { legacyDesignName: true } }),
    prisma.masterValue.findMany({
      where: {
        category: { code: MASTER.DESIGN_PATTERN },
        OR: [
          { designPatternUses: usedPattern },
          { bodyPatternUses: usedPattern },
          { inwardPatternUses: usedPattern },
          { inwardBodyPatternUses: usedPattern },
          { productionPatternUses: usedPattern },
          { productionBodyPatternUses: usedPattern },
        ],
      },
      select: { label: true, code: true },
    }),
    prisma.labSample.count({ where: { OR: [{ designCategory: "PLAIN_BODY" }, { bodies: { some: { designCategory: "PLAIN_BODY" } } }] } }),
    prisma.inwardOutwardEntry.count({ where: { OR: [{ designCategory: "PLAIN_BODY" }, { bodies: { some: { designCategory: "PLAIN_BODY" } } }] } }),
    prisma.productionSample.count({ where: { OR: [{ designCategory: "PLAIN_BODY" }, { bodies: { some: { designCategory: "PLAIN_BODY" } } }] } }),
    prisma.sampleDesignDetail.findMany({ distinct: ["type"], select: { type: true } }),
    prisma.inwardDesignDetail.findMany({ distinct: ["type"], select: { type: true } }),
  ]);

  const typeKeys = new Set<string>([...labTypes, ...inwardTypes].map((t) => t.type));
  const others: string[] = [];
  for (const p of patterns) {
    const k = typeOfPattern(p);
    if (k) typeKeys.add(k);
    else others.push(p.label);
  }
  return {
    sampleDesigns: distinctLabels([
      ...names.map((n) => n.label),
      ...labNames.map((n) => n.legacyDesignName),
      ...inwardNames.map((n) => n.legacySampleDesignName),
      ...productionNames.map((n) => n.legacyDesignName),
    ]),
    designTypes: [
      ...(plainLab + plainInward + plainProduction > 0 ? [PLAIN_BODY_LABEL] : []),
      ...DESIGN_TYPES.filter((t) => typeKeys.has(t.key)).map((t) => t.label),
      ...distinctLabels(others),
    ],
  };
}

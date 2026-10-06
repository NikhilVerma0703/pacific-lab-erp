import "server-only";
import { prisma } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { MASTER } from "@/modules/master-data/catalog";
import { bodyDesignsOrLegacy, designNamesOf } from "@/modules/samples/bodies";
import { tallyDesigns, type DesignTally } from "./designs";

export interface DashboardData {
  today: string;
  todayStats: {
    total: number;
    lab: number;
    line: number;
    designs: DesignTally[];
  };
  overall: {
    totalSamples: number;
    lab: number;
    line: number;
    designs: number;
    companies: number;
    rectification: number;
    production: number;
  };
}

const patternSelect = { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } } as const;
const bodySelect = {
  orderBy: { bodyIndex: "asc" },
  select: { bodyIndex: true, designCategory: true, designPatterns: patternSelect },
} as const;

/**
 * Line samples are not recorded yet, so Line is 0 and every lab sample counts
 * as a Lab sample. Production samples come from the Production Sample register.
 */
export async function getDashboard(): Promise<DashboardData> {
  const today = plantToday();
  const day = new Date(`${today}T00:00:00Z`);

  const [
    todaySamples,
    todayInward,
    totalSamples,
    rectification,
    companies,
    samplePatterns,
    inwardPatterns,
    plainUsed,
    usedDesignNames,
    inwardNames,
    sampleNames,
    production,
  ] = await Promise.all([
    prisma.labSample.findMany({
      where: { sampleDate: day },
      select: {
        numberOfBodies: true,
        designCategory: true,
        legacyDesignName: true,
        designNameValue: { select: { label: true } },
        designPatterns: patternSelect,
        bodies: bodySelect,
      },
    }),
    prisma.inwardOutwardEntry.findMany({
      where: { entryDate: day },
      select: {
        numberOfBodies: true,
        designCategory: true,
        legacySampleDesignName: true,
        designNameValue: { select: { label: true } },
        designPatterns: patternSelect,
        bodies: bodySelect,
      },
    }),
    prisma.labSample.count(),
    // Physical Sample Available? = No — the Rectification list in Inward / Outward.
    prisma.labSample.count({ where: { physicalSamplePresent: false } }),
    prisma.masterValue.count({ where: { isActive: true, category: { code: MASTER.COMPANY } } }),
    Promise.all([
      prisma.sampleDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
      prisma.sampleBodyDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
    ]).then(([a, b]) => [...a, ...b]),
    Promise.all([
      prisma.inwardDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
      prisma.inwardBodyDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
    ]).then(([a, b]) => [...a, ...b]),
    Promise.all([
      prisma.labSample.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }),
      prisma.sampleBody.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }),
      prisma.inwardOutwardEntry.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }),
      prisma.inwardBody.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }),
    ]).then((xs) => xs.some(Boolean)),
    // Design Names used by a lab sample or an Inward / Outward entry …
    prisma.masterValue.findMany({
      where: {
        category: { code: MASTER.DESIGN_NAME },
        OR: [{ samplesAsDesignName: { some: {} } }, { inwardsAsDesignName: { some: {} } }],
      },
      select: { label: true },
    }),
    // … and names typed before the Design Names list existed (not yet moved into it).
    prisma.inwardOutwardEntry.findMany({
      where: { legacySampleDesignName: { not: null } },
      distinct: ["legacySampleDesignName"],
      select: { legacySampleDesignName: true },
    }),
    prisma.labSample.findMany({
      where: { legacyDesignName: { not: null } },
      distinct: ["legacyDesignName"],
      select: { legacyDesignName: true },
    }),
    prisma.productionSample.count(),
  ]);

  // Every body counts: a record contributes each design of any of its bodies once.
  type WithBodies = Pick<(typeof todayInward)[number], "numberOfBodies" | "designCategory" | "designPatterns" | "bodies">;
  const bodyDesigns = (x: WithBodies) =>
    designNamesOf(
      bodyDesignsOrLegacy(
        x.bodies.map((b) => ({ bodyIndex: b.bodyIndex, designCategory: b.designCategory, patterns: b.designPatterns.map((p) => p.pattern) })),
        { designCategory: x.designCategory, patterns: x.designPatterns.map((p) => p.pattern) },
        x.numberOfBodies,
      ),
    );
  const todayDesigns = tallyDesigns([
    ...todaySamples.flatMap((s) => [...bodyDesigns(s), s.designNameValue?.label ?? s.legacyDesignName]),
    ...todayInward.flatMap((e) => [...bodyDesigns(e), e.designNameValue?.label ?? e.legacySampleDesignName]),
  ]);

  const allDesigns = tallyDesigns([
    ...samplePatterns.map((p) => p.pattern.label),
    ...inwardPatterns.map((p) => p.pattern.label),
    ...(plainUsed ? ["Plain Body"] : []),
    ...usedDesignNames.map((v) => v.label),
    ...inwardNames.map((n) => n.legacySampleDesignName),
    ...sampleNames.map((n) => n.legacyDesignName),
  ]);

  const lab = todaySamples.length;
  return {
    today,
    todayStats: {
      total: lab + 0,
      lab,
      line: 0,
      designs: todayDesigns,
    },
    overall: {
      totalSamples: totalSamples + 0,
      lab: totalSamples,
      line: 0,
      designs: allDesigns.length,
      companies,
      rectification,
      production,
    },
  };
}

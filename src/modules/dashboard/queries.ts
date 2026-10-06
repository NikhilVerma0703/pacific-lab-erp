import "server-only";
import { prisma } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import { bodyDesignsOrLegacy, designNamesOf } from "@/modules/samples/bodies";
import { tallyDesigns, type DesignTally } from "./designs";

export interface DashboardData {
  today: string;
  todayStats: {
    total: number;
    lab: number;
    line: number;
    creative: number;
    inspired: number;
    designs: DesignTally[];
  };
  overall: {
    totalSamples: number;
    lab: number;
    line: number;
    creative: number;
    inspired: number;
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
  const typeIs = (code: string) => ({ sampleType: { code } });

  const [
    todaySamples,
    todayInward,
    totalSamples,
    creative,
    inspired,
    rectification,
    companies,
    samplePatterns,
    inwardPatterns,
    plainUsed,
    inwardNames,
    sampleNames,
    production,
  ] = await Promise.all([
    prisma.labSample.findMany({
      where: { sampleDate: day },
      select: {
        numberOfBodies: true,
        designCategory: true,
        designName: true,
        sampleType: { select: { code: true } },
        designPatterns: patternSelect,
        bodies: bodySelect,
      },
    }),
    prisma.inwardOutwardEntry.findMany({
      where: { entryDate: day },
      select: { numberOfBodies: true, designCategory: true, sampleDesignName: true, designPatterns: patternSelect, bodies: bodySelect },
    }),
    prisma.labSample.count(),
    prisma.labSample.count({ where: typeIs(VALUE_CODE.CREATIVE_SAMPLE) }),
    prisma.labSample.count({ where: typeIs(VALUE_CODE.INSPIRED_SAMPLE) }),
    prisma.labSample.count({ where: { physicalSamplePresent: false, ...typeIs(VALUE_CODE.INSPIRED_SAMPLE) } }),
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
    prisma.inwardOutwardEntry.findMany({
      where: { sampleDesignName: { not: null } },
      distinct: ["sampleDesignName"],
      select: { sampleDesignName: true },
    }),
    prisma.labSample.findMany({
      where: { designName: { not: null } },
      distinct: ["designName"],
      select: { designName: true },
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
    ...todaySamples.flatMap((s) => [...bodyDesigns(s), s.designName]),
    ...todayInward.flatMap((e) => [...bodyDesigns(e), e.sampleDesignName]),
  ]);

  const allDesigns = tallyDesigns([
    ...samplePatterns.map((p) => p.pattern.label),
    ...inwardPatterns.map((p) => p.pattern.label),
    ...(plainUsed ? ["Plain Body"] : []),
    ...inwardNames.map((n) => n.sampleDesignName),
    ...sampleNames.map((n) => n.designName),
  ]);

  const lab = todaySamples.length;
  return {
    today,
    todayStats: {
      total: lab + 0,
      lab,
      line: 0,
      creative: todaySamples.filter((s) => s.sampleType?.code === VALUE_CODE.CREATIVE_SAMPLE).length,
      inspired: todaySamples.filter((s) => s.sampleType?.code === VALUE_CODE.INSPIRED_SAMPLE).length,
      designs: todayDesigns,
    },
    overall: {
      totalSamples: totalSamples + 0,
      lab: totalSamples,
      line: 0,
      creative,
      inspired,
      designs: allDesigns.length,
      companies,
      rectification,
      production,
    },
  };
}

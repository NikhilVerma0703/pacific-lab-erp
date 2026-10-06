import "server-only";
import { prisma } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import { designsOf, tallyDesigns, type DesignTally } from "./designs";

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

/**
 * Line samples and Production samples are not recorded yet (their sections
 * come later), so both are 0 and every sample counts as a Lab sample.
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
  ] = await Promise.all([
    prisma.labSample.findMany({
      where: { sampleDate: day },
      select: {
        designCategory: true,
        designName: true,
        sampleType: { select: { code: true } },
        designPatterns: patternSelect,
      },
    }),
    prisma.inwardOutwardEntry.findMany({
      where: { entryDate: day },
      select: { designCategory: true, sampleDesignName: true, designPatterns: patternSelect },
    }),
    prisma.labSample.count(),
    prisma.labSample.count({ where: typeIs(VALUE_CODE.CREATIVE_SAMPLE) }),
    prisma.labSample.count({ where: typeIs(VALUE_CODE.INSPIRED_SAMPLE) }),
    prisma.labSample.count({ where: { physicalSamplePresent: false, ...typeIs(VALUE_CODE.INSPIRED_SAMPLE) } }),
    prisma.masterValue.count({ where: { isActive: true, category: { code: MASTER.COMPANY } } }),
    prisma.sampleDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
    prisma.inwardDesignPattern.findMany({ distinct: ["patternId"], select: { pattern: { select: { label: true } } } }),
    prisma.labSample.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }).then(
      async (s) => s ?? prisma.inwardOutwardEntry.findFirst({ where: { designCategory: "PLAIN_BODY" }, select: { id: true } }),
    ),
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
  ]);

  const todayDesigns = tallyDesigns([
    ...todaySamples.flatMap((s) =>
      designsOf({ designCategory: s.designCategory, patterns: s.designPatterns.map((p) => p.pattern.label), designName: s.designName }),
    ),
    ...todayInward.flatMap((e) =>
      designsOf({ designCategory: e.designCategory, patterns: e.designPatterns.map((p) => p.pattern.label), designName: e.sampleDesignName }),
    ),
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
      production: 0,
    },
  };
}

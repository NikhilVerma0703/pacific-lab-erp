import "server-only";
import { prisma } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { MASTER } from "@/modules/master-data/catalog";
import { tallyDesigns, type DesignTally } from "./designs";

export interface DashboardData {
  today: string;
  todayStats: {
    total: number;
    lab: number;
    line: number;
    /** Design Names recorded today (Design Name / Sample Design Name only — not Design / Design Pattern). */
    designs: DesignTally[];
  };
  overall: {
    totalSamples: number;
    lab: number;
    line: number;
    designs: number;
    production: number;
  };
}


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
    samplePatterns,
    inwardPatterns,
    plainUsed,
    usedDesignNames,
    inwardNames,
    sampleNames,
    production,
  ] = await Promise.all([
    // Today: only the Design Name of each lab sample and the Sample Design Name of each Inward / Outward entry.
    prisma.labSample.findMany({
      where: { sampleDate: day },
      select: { legacyDesignName: true, designNameValue: { select: { label: true } } },
    }),
    prisma.inwardOutwardEntry.findMany({
      where: { entryDate: day },
      select: { legacySampleDesignName: true, designNameValue: { select: { label: true } } },
    }),
    prisma.labSample.count(),
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

  // Designs Worked On Today = the Design Names recorded today, each once (ignoring case);
  // Design / Design Pattern values are not counted here.
  const todayDesigns = tallyDesigns([
    ...todaySamples.map((s) => s.designNameValue?.label ?? s.legacyDesignName),
    ...todayInward.map((e) => e.designNameValue?.label ?? e.legacySampleDesignName),
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
      production,
    },
  };
}

import "server-only";
import { prisma } from "@/lib/db";
import { todayInPlant } from "@/modules/samples/service";
import { bodyDesignsOrLegacy, designNamesOf } from "@/modules/samples/bodies";
import { buildReport, dateWindow, type ReportData, type ReportRange, type ReportSampleRow } from "./build";

const componentSelect = { kind: true, unit: true, quantity: true, material: { select: { label: true } } } as const;
const bodyDesignSelect = {
  select: { bodyIndex: true, designCategory: true, designPatterns: { select: { pattern: { select: { label: true } } } } },
} as const;

/** Every sample dated inside the window, with what the reports need. */
export async function getReport(days: ReportRange): Promise<ReportData> {
  const today = todayInPlant();
  const dates = dateWindow(today, days);
  const window = { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${today}T00:00:00Z`) };
  const productionSamples = await prisma.productionSample.findMany({
    where: { sampleDate: window },
    select: { sampleDate: true },
  });
  const samples = await prisma.labSample.findMany({
    where: {
      sampleDate: window,
    },
    select: {
      sampleDate: true,
      numberOfBodies: true,
      designCategory: true,
      sampleType: { select: { code: true } },
      designPatterns: { select: { pattern: { select: { label: true } } } },
      bodies: bodyDesignSelect,
      // Inspired samples record their design on the Inward / Outward entry.
      inwardEntry: {
        select: {
          numberOfBodies: true,
          designCategory: true,
          designPatterns: { select: { pattern: { select: { label: true } } } },
          bodies: bodyDesignSelect,
        },
      },
      formulations: {
        select: {
          components: { select: componentSelect },
          // The Roy Body opened from a Roy Body's own Vein.
          children: { select: { components: { select: componentSelect } } },
        },
      },
    },
  });

  type Designed = {
    numberOfBodies: number | null;
    designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
    designPatterns: { pattern: { label: string } }[];
    bodies: { bodyIndex: number; designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null; designPatterns: { pattern: { label: string } }[] }[];
  };
  const designsOf = (x: Designed) =>
    bodyDesignsOrLegacy(
      x.bodies.map((b) => ({ bodyIndex: b.bodyIndex, designCategory: b.designCategory, patterns: b.designPatterns.map((p) => p.pattern) })),
      { designCategory: x.designCategory, patterns: x.designPatterns.map((p) => p.pattern) },
      x.numberOfBodies,
    );

  const rows: ReportSampleRow[] = samples.map((s) => {
    const own = designsOf(s);
    const bodies = own.some((b) => b.designCategory !== null) || !s.inwardEntry ? own : designsOf(s.inwardEntry);
    return {
      date: s.sampleDate.toISOString().slice(0, 10),
      typeCode: s.sampleType?.code ?? null,
      designs: designNamesOf(bodies, "Non-Plain (no pattern)"),
      // Every body's formulations and every Roy Body: all of it was consumed making the sample.
      components: s.formulations.flatMap((f) =>
        [...f.components, ...f.children.flatMap((ch) => ch.components)].map((c) => ({
          kind: c.kind,
          unit: c.unit,
          quantity: c.quantity === null ? null : Number(c.quantity),
          material: c.material?.label ?? null,
        })),
      ),
    };
  });

  return buildReport(
    rows,
    today,
    days,
    productionSamples.map((p) => p.sampleDate.toISOString().slice(0, 10)),
  );
}

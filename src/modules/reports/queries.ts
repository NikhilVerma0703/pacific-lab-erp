import "server-only";
import { prisma } from "@/lib/db";
import { todayInPlant } from "@/modules/samples/service";
import { buildReport, dateWindow, type ReportData, type ReportRange, type ReportSampleRow } from "./build";

/** Every sample dated inside the window, with what the reports need. */
export async function getReport(days: ReportRange): Promise<ReportData> {
  const today = todayInPlant();
  const dates = dateWindow(today, days);
  const samples = await prisma.labSample.findMany({
    where: {
      sampleDate: { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${today}T00:00:00Z`) },
    },
    select: {
      sampleDate: true,
      designCategory: true,
      sampleType: { select: { code: true } },
      designPatterns: { select: { pattern: { select: { label: true } } } },
      // Inspired samples record their design on the Inward / Outward entry.
      inwardEntry: {
        select: { designCategory: true, designPatterns: { select: { pattern: { select: { label: true } } } } },
      },
      formulations: {
        select: {
          components: {
            select: { kind: true, unit: true, quantity: true, material: { select: { label: true } } },
          },
        },
      },
    },
  });

  const rows: ReportSampleRow[] = samples.map((s) => {
    const own = s.designCategory !== null;
    const design = own ? s : (s.inwardEntry ?? s);
    return {
      date: s.sampleDate.toISOString().slice(0, 10),
      typeCode: s.sampleType?.code ?? null,
      designCategory: design.designCategory,
      patterns: design.designPatterns.map((p) => p.pattern.label),
      // Main body + every Roy Body: all of it was consumed making the sample.
      components: s.formulations.flatMap((f) =>
        f.components.map((c) => ({
          kind: c.kind,
          unit: c.unit,
          quantity: c.quantity === null ? null : Number(c.quantity),
          material: c.material?.label ?? null,
        })),
      ),
    };
  });

  return buildReport(rows, today, days);
}

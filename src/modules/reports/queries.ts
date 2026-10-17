import "server-only";
import { prisma } from "@/lib/db";
import { designTypeLabels } from "@/modules/forms/design-types";
import { todayInPlant } from "@/modules/samples/service";
import { buildReport, dateWindow, type ReportData, type ReportRange, type ReportSampleRow } from "./build";

const componentSelect = { kind: true, unit: true, quantity: true, material: { select: { label: true } } } as const;
const additiveSelect = { quantity: true, additive: { select: { label: true } } } as const;

/**
 * Every record dated inside the window, with what the reports need. Design
 * types come from the Lab Sample and Sample Inward / Outward databases (one
 * row per record, with its Plain Body and design types).
 */
export async function getReport(days: ReportRange): Promise<ReportData> {
  const today = todayInPlant();
  const dates = dateWindow(today, days);
  const window = { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${today}T00:00:00Z`) };
  const [productionSamples, samples, labDesigns, inwardDesigns] = await Promise.all([
    prisma.productionSample.findMany({ where: { sampleDate: window }, select: { sampleDate: true } }),
    prisma.labSample.findMany({
      where: { sampleDate: window },
      select: {
        id: true,
        sampleDate: true,
        formulations: {
          select: {
            components: { select: componentSelect },
            additives: { select: additiveSelect },
            // The Roy Body opened from a Roy Body's own Vein (earlier form).
            children: { select: { components: { select: componentSelect } } },
          },
        },
      },
    }),
    prisma.labSampleRecord.findMany({ where: { sampleDate: window }, select: { sampleId: true, plainBody: true, designTypes: true } }),
    prisma.inwardOutwardRecord.findMany({ where: { entryDate: window }, select: { entryDate: true, plainBody: true, designTypes: true } }),
  ]);
  const designOf = new Map(labDesigns.map((r) => [r.sampleId, designTypeLabels(r.plainBody, r.designTypes)]));

  const rows: ReportSampleRow[] = samples.map((s) => ({
    date: s.sampleDate.toISOString().slice(0, 10),
    designs: designOf.get(s.id) ?? [],
    // Every body's materials (regular, Roy and Chessboard bodies): all of it was consumed making the sample.
    components: s.formulations.flatMap((f) => [
      ...[...f.components, ...f.children.flatMap((ch) => ch.components)].map((c) => ({
        kind: c.kind,
        unit: c.unit,
        quantity: c.quantity === null ? null : Number(c.quantity),
        material: c.material?.label ?? null,
      })),
      ...f.additives.map((a) => ({
        kind: "ADDITIVE" as const,
        unit: "GRAMS" as const,
        quantity: a.quantity === null ? null : Number(a.quantity),
        material: a.additive.label,
      })),
    ]),
  }));

  return buildReport(
    rows,
    today,
    days,
    productionSamples.map((p) => p.sampleDate.toISOString().slice(0, 10)),
    inwardDesigns.map((e) => ({ date: e.entryDate.toISOString().slice(0, 10), designs: designTypeLabels(e.plainBody, e.designTypes) })),
  );
}

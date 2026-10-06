import "server-only";
import { prisma } from "@/lib/db";
import { inwardInclude } from "@/modules/inward-outward/service";
import { toInwardDetail, type InwardDetail } from "@/modules/inward-outward/queries";
import { sampleInclude } from "@/modules/samples/service";
import { toDetail, type SampleDetail } from "@/modules/samples/queries";
import { productionInclude } from "@/modules/production/service";
import { toProductionDetail, type ProductionDetail } from "@/modules/production/queries";
import { periodWhere, type Period } from "./period";
import { designAcross, type BodiesDesign } from "./filters";

/**
 * What "Production Date" means per record — each record's own Date field:
 *  - Data Entry samples → the sample's Date
 *  - Inward / Outward entries → the entry's Date
 *  - Production samples → the production sample's Date
 * Records come oldest date first, then by number.
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

export async function inwardByIds(ids: string[]): Promise<InwardDetail[]> {
  if (!ids.length) return [];
  const rows = await prisma.inwardOutwardEntry.findMany({ where: { id: { in: ids } }, include: inwardInclude });
  return rows.map(toInwardDetail);
}

export interface CompleteRow {
  sample: SampleDetail | null;
  inward: InwardDetail | null;
}

/**
 * Complete report for a period: every lab sample dated in it with its
 * Inward / Outward entry (if any), plus inward entries dated in it that are
 * not already on a row (stand-alone, or linked to a sample of another date).
 */
export async function completeIn(period: Period): Promise<CompleteRow[]> {
  const [samples, inwardInPeriod] = await Promise.all([samplesIn(period), inwardIn(period)]);
  const linkedIds = samples.map((s) => s.inwardEntry?.id).filter((x): x is string => !!x);
  const linked = await inwardByIds(linkedIds.filter((id) => !inwardInPeriod.some((e) => e.id === id)));
  const byId = new Map([...inwardInPeriod, ...linked].map((e) => [e.id, e]));
  const rows: CompleteRow[] = samples.map((s) => ({ sample: s, inward: s.inwardEntry ? (byId.get(s.inwardEntry.id) ?? null) : null }));
  const used = new Set(rows.map((r) => r.inward?.id).filter(Boolean));
  for (const e of inwardInPeriod) if (!used.has(e.id)) rows.push({ sample: null, inward: e });
  return rows;
}

/** How many records the period holds, per kind. */
export async function countsIn(period: Period) {
  const w = periodWhere(period);
  const [samples, inward, production] = await Promise.all([
    prisma.labSample.count({ where: { sampleDate: w } }),
    prisma.inwardOutwardEntry.count({ where: { entryDate: w } }),
    prisma.productionSample.count({ where: { sampleDate: w } }),
  ]);
  return { samples, inward, production };
}

/** Designs (across bodies) of the Inward entries linked to these samples (used when a sample has no design of its own). */
export async function inwardDesignsFor(samples: SampleDetail[]): Promise<Map<string, BodiesDesign>> {
  const entries = await inwardByIds(samples.map((s) => s.inwardEntry?.id).filter((x): x is string => !!x));
  return new Map(entries.map((e) => [e.id, designAcross(e.bodies)]));
}

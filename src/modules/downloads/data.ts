import "server-only";
import { prisma } from "@/lib/db";
import { inwardInclude } from "@/modules/inward-outward/service";
import { toInwardDetail, type InwardDetail } from "@/modules/inward-outward/queries";
import { sampleInclude } from "@/modules/samples/service";
import { toDetail, type SampleDetail } from "@/modules/samples/queries";

/**
 * What a "date" means per record:
 *  - Data Entry samples → the sample's Date field
 *  - Inward / Outward entries → the entry's Date field
 */
export async function samplesOn(date: string): Promise<SampleDetail[]> {
  const rows = await prisma.labSample.findMany({
    where: { sampleDate: new Date(`${date}T00:00:00Z`) },
    include: sampleInclude,
    orderBy: { serialNo: "asc" },
  });
  return rows.map(toDetail);
}

export async function inwardOn(date: string): Promise<InwardDetail[]> {
  const rows = await prisma.inwardOutwardEntry.findMany({
    where: { entryDate: new Date(`${date}T00:00:00Z`) },
    include: inwardInclude,
    orderBy: { serialNo: "asc" },
  });
  return rows.map(toInwardDetail);
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
 * Complete report for a date: every lab sample dated that day with its
 * Inward / Outward entry (if any), plus inward entries recorded that day that
 * are not already on a row (stand-alone, or linked to a sample of another day).
 */
export async function completeOn(date: string): Promise<CompleteRow[]> {
  const [samples, inwardToday] = await Promise.all([samplesOn(date), inwardOn(date)]);
  const linkedIds = samples.map((s) => s.inwardEntry?.id).filter((x): x is string => !!x);
  const linked = await inwardByIds(linkedIds.filter((id) => !inwardToday.some((e) => e.id === id)));
  const byId = new Map([...inwardToday, ...linked].map((e) => [e.id, e]));
  const rows: CompleteRow[] = samples.map((s) => ({ sample: s, inward: s.inwardEntry ? (byId.get(s.inwardEntry.id) ?? null) : null }));
  const used = new Set(rows.map((r) => r.inward?.id).filter(Boolean));
  for (const e of inwardToday) if (!used.has(e.id)) rows.push({ sample: null, inward: e });
  return rows;
}

export async function countsOn(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  const [samples, inward] = await Promise.all([
    prisma.labSample.count({ where: { sampleDate: day } }),
    prisma.inwardOutwardEntry.count({ where: { entryDate: day } }),
  ]);
  return { samples, inward };
}

/** Designs of the Inward entries linked to these samples (for Inspired samples). */
export async function inwardDesignsFor(samples: SampleDetail[]) {
  const entries = await inwardByIds(samples.map((s) => s.inwardEntry?.id).filter((x): x is string => !!x));
  return new Map(entries.map((e) => [e.id, { designCategory: e.designCategory, designPatterns: e.designPatterns }]));
}

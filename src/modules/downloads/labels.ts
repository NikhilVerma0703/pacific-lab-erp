import "server-only";
import { prisma } from "@/lib/db";
import type { ExportFilters } from "./filters";

/** Human-readable names of the chosen filters (for the sheet and the page). */
export async function filterLabels(f: ExportFilters): Promise<Record<string, string>> {
  const ids = [f.pattern, f.material].filter(Boolean);
  const values = ids.length ? await prisma.masterValue.findMany({ where: { id: { in: ids } }, select: { id: true, label: true } }) : [];
  const name = (id: string) => values.find((v) => v.id === id)?.label;
  const out: Record<string, string> = {};
  if (f.sampleType) out.sampleType = f.sampleType === "CREATIVE" ? "Creative Sample" : "Inspired Sample";
  if (f.design) out.design = f.design === "PLAIN_BODY" ? "Plain Body" : "Non-Plain Body";
  if (f.pattern && name(f.pattern)) out.pattern = name(f.pattern)!;
  if (f.material && name(f.material)) out.material = name(f.material)!;
  return out;
}

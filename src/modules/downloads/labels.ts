import "server-only";
import { prisma } from "@/lib/db";
import { SAMPLE_TYPE_OPTIONS, type ExportFilters } from "./filters";

/** Human-readable names of the chosen filters (for the sheet and the page). */
export async function filterLabels(f: ExportFilters): Promise<Record<string, string>> {
  const pattern = f.pattern ? await prisma.masterValue.findUnique({ where: { id: f.pattern }, select: { label: true } }) : null;
  const out: Record<string, string> = {};
  if (f.sampleType) out.sampleType = SAMPLE_TYPE_OPTIONS.find((o) => o.value === f.sampleType)!.label;
  if (f.design) out.design = f.design === "PLAIN_BODY" ? "Plain Body" : "Non-Plain Body";
  if (pattern) out.pattern = pattern.label;
  return out;
}

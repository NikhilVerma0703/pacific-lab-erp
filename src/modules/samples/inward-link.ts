import "server-only";
import { prisma } from "@/lib/db";
import { normalizeKey } from "@/lib/normalize";
import { designType, orderTypes, type DesignTypeKey } from "@/modules/forms/design-types";
import type { InwardDetail } from "@/modules/inward-outward/queries";
import type { MasterOption, MasterRef } from "@/modules/master-data/types";
import type { DesignSuggestion } from "./design-suggestion";

/*
 * Lab Sample form ← Sample Inward / Outward Database (`InwardOutwardRecord`).
 * Inward / Outward is the master of existing physical samples: its saved
 * Design Names are the Lab Sample form's Design Name options, and each saved
 * design of a name (Plain Body / design types) can fill the Lab Sample form —
 * Design Type, Number of Bodies (N), n, and the L, a, b readings as Post
 * Polish. Read-only: the inward records are never changed.
 */

/** Design Names used by saved Inward / Outward entries (plus `includeIds`, e.g. the sample being edited). */
export async function inwardDesignNameOptions(includeIds: string[] = []): Promise<MasterOption[]> {
  const used = await prisma.inwardOutwardRecord.findMany({ where: { designNameId: { not: null } }, select: { designNameId: true }, distinct: ["designNameId"] });
  const ids = [...new Set([...used.map((u) => u.designNameId!), ...includeIds])];
  if (!ids.length) return [];
  const values = await prisma.masterValue.findMany({
    where: { id: { in: ids } },
    select: { id: true, label: true, code: true, isActive: true },
  });
  return values.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }));
}

/** "A – Roy Body + Carrara" */
const comboText = (plainBody: boolean | null, types: DesignTypeKey[]) =>
  plainBody === true ? "Plain Body" : plainBody === false ? (types.length ? types.map((k) => designType(k).label).join(" + ") : "Non-Plain Body") : "Design not recorded";

/**
 * Every saved design of a Design Name in the Inward / Outward Database — one
 * suggestion per design (Plain Body, or the same set of design types), taken
 * from the latest entry with that design; never mixing designs.
 */
export async function inwardDesignSuggestions(ref: MasterRef | null): Promise<DesignSuggestion[]> {
  if (!ref) return [];
  const label = ref.label?.trim() ?? "";
  if (!ref.id && !label) return [];
  const records = await prisma.inwardOutwardRecord.findMany({
    where: { OR: [...(ref.id ? [{ designNameId: ref.id }] : []), ...(label ? [{ designName: { equals: label, mode: "insensitive" as const } }] : [])] },
    orderBy: [{ entryDate: "desc" }, { serialNo: "desc" }],
  });
  const key = normalizeKey(label);
  const groups = new Map<string, DesignSuggestion>();
  for (const r of records) {
    if (!ref.id && normalizeKey(r.designName ?? "") !== key) continue;
    const d = r.data as unknown as InwardDetail;
    const types = r.plainBody === false ? orderTypes(r.designTypes) : [];
    const hasReadings = d.bodies.some((b) => b.lab) || d.royBodies.length > 0 || d.chessboardBodies.length > 0;
    if (r.plainBody === null && !hasReadings) continue; // nothing to suggest
    const k = `${r.plainBody}|${types.join(",")}`;
    const seen = groups.get(k);
    if (seen) {
      seen.records += 1;
      continue;
    }
    const count = (t: DesignTypeKey, list: unknown[]) => d.designTypes.find((x) => x.type === t)?.bodyCount ?? (list.length || null);
    groups.set(k, {
      key: k,
      designName: r.designName ?? label,
      design: comboText(r.plainBody, types),
      plainBody: r.plainBody,
      designTypes: types,
      numberOfBodies: r.numberOfBodies ?? (d.bodies.length || null),
      royCount: types.includes("ROY_BODY") ? count("ROY_BODY", d.royBodies) : null,
      chessCount: types.includes("CHESSBOARD") ? count("CHESSBOARD", d.chessboardBodies) : null,
      readings: d.bodies.map((b) => b.lab),
      royReadings: types.includes("ROY_BODY") ? d.royBodies : [],
      chessboardReadings: types.includes("CHESSBOARD") ? d.chessboardBodies : [],
      source: { entryId: r.entryId, serialNo: r.serialNo, slabNumber: r.slabNumber, entryDate: r.entryDate.toISOString().slice(0, 10) },
      records: 1,
    });
  }
  return [...groups.values()];
}

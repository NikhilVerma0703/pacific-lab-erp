import "server-only";
import type { Tx } from "@/lib/db";
import { normalizeKey } from "@/lib/normalize";
import { MASTER } from "@/modules/master-data/catalog";
import { categoryId } from "@/modules/master-data/service";
import { designType, typeOfPattern, type DesignTypeKey } from "./design-types";

/**
 * The Design Patterns value of a design type: by its code, else by its name
 * (given the code), else created. Keeps the types visible to the Dashboard,
 * Reports and Downloads as design patterns.
 */
export async function patternFor(tx: Tx, type: DesignTypeKey, userId: string): Promise<string> {
  const t = designType(type);
  const catId = await categoryId(MASTER.DESIGN_PATTERN, tx);
  const byCode = await tx.masterValue.findFirst({ where: { categoryId: catId, code: t.code }, select: { id: true } });
  if (byCode) return byCode.id;
  const key = normalizeKey(t.patternLabel);
  const byName = await tx.masterValue.findUnique({ where: { categoryId_normalizedKey: { categoryId: catId, normalizedKey: key } } });
  if (byName) {
    if (!byName.code) await tx.masterValue.update({ where: { id: byName.id }, data: { code: t.code } });
    return byName.id;
  }
  const created = await tx.masterValue.create({
    data: { categoryId: catId, label: t.patternLabel, normalizedKey: key, code: t.code, isActive: true, isSystem: true, createdById: userId },
  });
  return created.id;
}

/**
 * Design patterns recorded by an earlier form that are not one of the design
 * types (e.g. "Calacatta"): the rebuilt forms cannot show them, so a save
 * keeps them (with Plain Body – No) instead of dropping them. Distinct ids,
 * first-seen order.
 */
export function otherPatternIds(patterns: { id: string; code: string | null; label: string }[]): string[] {
  const out: string[] = [];
  for (const p of patterns) if (!typeOfPattern(p) && !out.includes(p.id)) out.push(p.id);
  return out;
}

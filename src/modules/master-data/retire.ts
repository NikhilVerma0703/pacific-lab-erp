/**
 * Keeps the master lists in step with the catalog on an existing database.
 * Shared by the seed script and the server (once per process), so no
 * server-only imports. Safe to run any number of times.
 */
import type { PrismaClient } from "@prisma/client";
import { CATALOG, RETIRED_CATEGORY_CODES, TYPED_ONLY_CODES } from "./catalog";

type Db = PrismaClient;

/** Catalog names and descriptions (e.g. "Design Patterns" → "Design Types"); lists are not renamed anywhere else. */
export async function syncCatalogText(db: Db): Promise<string[]> {
  const lines: string[] = [];
  const cats = await db.masterCategory.findMany({ where: { code: { in: CATALOG.map((c) => c.code) } } });
  for (const c of cats) {
    const entry = CATALOG.find((e) => e.code === c.code)!;
    if (c.name !== entry.name || c.description !== entry.description) {
      await db.masterCategory.update({ where: { id: c.id }, data: { name: entry.name, description: entry.description } });
      if (c.name !== entry.name) lines.push(`Renamed list ${c.name} → ${entry.name}.`);
    }
  }
  return lines;
}

/**
 * Predefined values of the material lists (seeded by an earlier version):
 * deleted when no record uses them, otherwise hidden — disabled, kept for
 * the records that show them, out of every dropdown and of Master Data.
 * Values people typed are never touched (a hidden one typed again becomes
 * theirs: see `resolveMasterRef`).
 */
export async function retirePredefinedValues(db: Db): Promise<string[]> {
  const rows = await db.masterValue.findMany({
    // Once per value: a hidden one is not tried again.
    where: { isSystem: true, isActive: true, category: { code: { in: [...TYPED_ONLY_CODES] } } },
    select: {
      id: true,
      _count: { select: { componentsAsMaterial: true, componentsAsSize: true, formulationAdditiveUses: true, sampleDesignColourUses: true, inwardDesignColourUses: true } },
    },
  });
  let deleted = 0;
  let hidden = 0;
  for (const v of rows) {
    const used = Object.values(v._count).some((n) => n > 0);
    try {
      if (used) throw new Error("in use");
      await db.masterValue.delete({ where: { id: v.id } });
      deleted++;
    } catch {
      // Still used by a record (the foreign keys restrict deletes): hide it instead.
      await db.masterValue.update({ where: { id: v.id }, data: { isActive: false } });
      hidden++;
    }
  }
  return deleted || hidden ? [`Predefined material values: ${deleted} removed, ${hidden} hidden (still used by saved records).`] : [];
}

/** Lists retired from the catalog: removed when nothing refers to them (else they stay hidden). */
export async function removeRetiredLists(db: Db): Promise<string[]> {
  const lines: string[] = [];
  for (const code of RETIRED_CATEGORY_CODES) {
    const cat = await db.masterCategory.findUnique({ where: { code } });
    if (!cat) continue;
    try {
      await db.$transaction([db.masterValue.deleteMany({ where: { categoryId: cat.id } }), db.masterCategory.delete({ where: { id: cat.id } })]);
      lines.push(`Removed retired list ${code}.`);
    } catch {
      lines.push(`Retired list ${code} is still referenced — it stays hidden.`);
    }
  }
  return lines;
}

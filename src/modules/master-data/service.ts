import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { cleanLabel, MAX_LABEL_LENGTH, normalizeKey } from "@/lib/normalize";
import { CATALOG, MASTER, type MasterCode } from "./catalog";
import type { MasterOption, MasterOptions, MasterRef } from "./types";

/** Category ids by code, cached per process (categories rarely change). */
let categoryCache: Map<string, string> | null = null;

export async function categoryId(code: MasterCode, tx: Tx | typeof prisma = prisma): Promise<string> {
  if (!categoryCache) {
    const rows = await tx.masterCategory.findMany({ select: { id: true, code: true } });
    categoryCache = new Map(rows.map((r) => [r.code, r.id]));
  }
  const id = categoryCache.get(code);
  if (!id) {
    categoryCache = null;
    throw new Error(`Master list "${code}" is missing. Run \`npm run db:seed\`.`);
  }
  return id;
}

/**
 * Every list a data-entry form needs. Active values, plus — when editing — any
 * disabled value the sample already uses, so old records still display.
 */
export async function getMasterOptions(includeIds: string[] = []): Promise<MasterOptions> {
  const rows = await prisma.masterValue.findMany({
    where: { OR: [{ isActive: true }, { id: { in: includeIds } }], category: { isActive: true } },
    select: { id: true, label: true, code: true, isActive: true, category: { select: { code: true } } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const out = Object.fromEntries(Object.values(MASTER).map((c) => [c, [] as MasterOption[]])) as MasterOptions;
  for (const r of rows) {
    const list = out[r.category.code as MasterCode];
    if (list) list.push({ id: r.id, label: r.label, code: r.code, isActive: r.isActive });
  }
  return out;
}

export class MasterValueError extends Error {}

/**
 * Turn a form's MasterRef into a MasterValue id, inside the save transaction.
 *
 *  - id given  → verify it belongs to the right list
 *  - label     → reuse an existing value with the same normalised key
 *                (re-enabling it when the user asked to save it), or create one.
 *                `save: false` creates it disabled: stored with the sample, kept
 *                out of everyone's dropdown until someone enables it.
 */
export async function resolveMasterRef(
  tx: Tx,
  code: MasterCode,
  ref: MasterRef | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!ref) return null;
  const catId = await categoryId(code, tx);

  if (ref.id) {
    const found = await tx.masterValue.findFirst({ where: { id: ref.id, categoryId: catId }, select: { id: true } });
    if (!found) throw new MasterValueError(`“${ref.label}” is not a valid ${listName(code)} value.`);
    return found.id;
  }

  const label = cleanLabel(ref.label ?? "");
  if (!label) return null;
  if (label.length > MAX_LABEL_LENGTH) {
    throw new MasterValueError(`${listName(code)}: “${label.slice(0, 30)}…” is too long (max ${MAX_LABEL_LENGTH}).`);
  }
  const key = normalizeKey(label);
  const save = ref.save !== false;

  const existing = await tx.masterValue.findUnique({
    where: { categoryId_normalizedKey: { categoryId: catId, normalizedKey: key } },
  });
  if (existing) {
    if (save && !existing.isActive) {
      await tx.masterValue.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return existing.id;
  }

  try {
    const created = await tx.masterValue.create({
      data: { categoryId: catId, label, normalizedKey: key, isActive: save, createdById: userId },
    });
    return created.id;
  } catch (e) {
    // Someone else added the same value a moment ago.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await tx.masterValue.findUniqueOrThrow({
        where: { categoryId_normalizedKey: { categoryId: catId, normalizedKey: key } },
      });
      return again.id;
    }
    throw e;
  }
}

export function listName(code: MasterCode): string {
  return CATALOG.find((c) => c.code === code)?.name ?? code;
}

/** Category list with value counts — for the Master Data screen. */
export async function listCategories() {
  const cats = await prisma.masterCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { values: true } } },
  });
  const active = await prisma.masterValue.groupBy({
    by: ["categoryId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const activeBy = new Map(active.map((a) => [a.categoryId, a._count._all]));
  return cats.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    total: c._count.values,
    active: activeBy.get(c.id) ?? 0,
  }));
}

/** Values in one category with how many samples use each. */
export async function listValues(categoryCode: string) {
  const cat = await prisma.masterCategory.findUnique({ where: { code: categoryCode } });
  if (!cat) return null;
  const values = await prisma.masterValue.findMany({
    where: { categoryId: cat.id },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: {
        select: {
          samplesAsType: true,
          samplesAsMixer: true,
          componentsAsMaterial: true,
          componentsAsSize: true,
          designPatternUses: true,
          veinMethodUses: true,
          inwardCompanyUses: true,
          inwardPatternUses: true,
          formulationsAsMixer: true,
          formulationVeinUses: true,
          productionPatternUses: true,
          bodiesAsMixer: true,
          bodyPatternUses: true,
          bodyVeinMethodUses: true,
          inwardBodyPatternUses: true,
          productionBodyPatternUses: true,
        },
      },
    },
  });
  return {
    category: { id: cat.id, code: cat.code, name: cat.name, description: cat.description },
    values: values.map((v) => {
      const c = v._count;
      return {
        id: v.id,
        label: v.label,
        code: v.code,
        isActive: v.isActive,
        isSystem: v.isSystem,
        sortOrder: v.sortOrder,
        createdBy: v.createdBy?.name ?? null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        usage:
          c.samplesAsType +
          c.samplesAsMixer +
          c.componentsAsMaterial +
          c.componentsAsSize +
          c.designPatternUses +
          c.veinMethodUses +
          c.inwardCompanyUses +
          c.inwardPatternUses +
          c.formulationsAsMixer +
          c.formulationVeinUses +
          c.productionPatternUses +
          c.bodiesAsMixer +
          c.bodyPatternUses +
          c.bodyVeinMethodUses +
          c.inwardBodyPatternUses +
          c.productionBodyPatternUses,
      };
    }),
  };
}

export type MasterValueRow = NonNullable<Awaited<ReturnType<typeof listValues>>>["values"][number];

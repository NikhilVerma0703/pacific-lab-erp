import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { cleanLabel, compareLabels, normalizeKey } from "@/lib/normalize";
import { backfillTypedValues } from "./backfill";
import { CATALOG, catalogSortOrder, HIDDEN_CATEGORY_CODES, labelLimit, MASTER, TYPED_ONLY_CODES, type MasterCode } from "./catalog";
import { retirePredefinedValues, syncCatalogText } from "./retire";
import type { MasterOption, MasterOptions, MasterRef } from "./types";

/** Category ids by code, cached per process (categories rarely change). */
let categoryCache: Map<string, string> | null = null;

export async function categoryId(code: MasterCode, tx: Tx | typeof prisma = prisma): Promise<string> {
  if (!categoryCache) {
    const rows = await tx.masterCategory.findMany({ select: { id: true, code: true } });
    categoryCache = new Map(rows.map((r) => [r.code, r.id]));
  }
  // A list added in a newer version (e.g. Design Names) exists before anyone re-runs the seed.
  if (!categoryCache.has(code) && (await ensureCatalogCategories())) return categoryId(code, tx);
  const id = categoryCache.get(code);
  if (!id) {
    categoryCache = null;
    throw new Error(`Master list "${code}" is missing. Run \`npm run db:seed\`.`);
  }
  return id;
}

let catalogChecked = false;

/**
 * Create any list of the catalog that the database does not have yet (empty —
 * its starting values still come from `npm run db:seed`), then move values
 * typed before that list existed into it. Checked once per server process.
 * Returns true when something was created. Runs outside any save transaction,
 * so the new list stays even if that save fails.
 */
async function ensureCatalogCategories(db: typeof prisma = prisma): Promise<boolean> {
  const have = new Set((await db.masterCategory.findMany({ select: { code: true } })).map((c) => c.code));
  let created = false;
  for (const [i, entry] of CATALOG.entries()) {
    if (have.has(entry.code)) continue;
    await db.masterCategory.upsert({
      where: { code: entry.code },
      update: {},
      create: { code: entry.code, name: entry.name, description: entry.description, sortOrder: catalogSortOrder(entry, i) },
    });
    created = true;
  }
  if (created) {
    categoryCache = null;
    try {
      for (const line of await backfillTypedValues(db)) console.log(line);
    } catch (e) {
      // `npm run db:seed` does the same; the app works without it meanwhile.
      console.error("master-data backfill", e);
    }
  }
  catalogChecked = true;
  return created;
}

let maintained: Promise<void> | null = null;

/**
 * Once per server process: list names / descriptions from the catalog, and the
 * material lists' predefined values removed (see `retire.ts`). `npm run db:seed`
 * does the same.
 */
function maintainCatalog(): Promise<void> {
  maintained ??= (async () => {
    try {
      for (const line of [...(await syncCatalogText(prisma)), ...(await retirePredefinedValues(prisma))]) console.log(line);
    } catch (e) {
      maintained = null;
      console.error("master-data maintenance", e);
    }
  })();
  return maintained;
}

/** Predefined material values hidden because records still use them — not shown in Master Data. */
const retiredPredefined: Prisma.MasterValueWhereInput = { isSystem: true, isActive: false, category: { code: { in: [...TYPED_ONLY_CODES] } } };

/**
 * Every list a data-entry form needs. Active values, plus — when editing — any
 * disabled value the sample already uses, so old records still display.
 */
export async function getMasterOptions(includeIds: string[] = []): Promise<MasterOptions> {
  if (!catalogChecked) await ensureCatalogCategories();
  await maintainCatalog();
  const rows = await prisma.masterValue.findMany({
    where: { OR: [{ isActive: true }, { id: { in: includeIds } }], category: { isActive: true } },
    select: { id: true, label: true, code: true, isActive: true, sortOrder: true, category: { select: { code: true } } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  // Same position → alphabetical ignoring case (the database may sort "Zebra" before "apple").
  rows.sort((a, b) => a.sortOrder - b.sortOrder || compareLabels(a.label, b.label));
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
  if (label.length > labelLimit(code)) {
    throw new MasterValueError(`${listName(code)}: “${label.slice(0, 30)}…” is too long (max ${labelLimit(code)}).`);
  }
  const key = normalizeKey(label);
  const save = ref.save !== false;

  const existing = await tx.masterValue.findUnique({
    where: { categoryId_normalizedKey: { categoryId: catId, normalizedKey: key } },
  });
  if (existing) {
    if (save && !existing.isActive) {
      // A hidden predefined material value typed again becomes the user's own value.
      await tx.masterValue.update({ where: { id: existing.id }, data: { isActive: true, ...(TYPED_ONLY_CODES.includes(code) ? { isSystem: false } : {}) } });
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
  await ensureCatalogCategories();
  await maintainCatalog();
  const cats = await prisma.masterCategory.findMany({
    where: { code: { notIn: [...HIDDEN_CATEGORY_CODES] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const [all, active] = await Promise.all([
    prisma.masterValue.groupBy({ by: ["categoryId"], where: { NOT: retiredPredefined }, _count: { _all: true } }),
    prisma.masterValue.groupBy({ by: ["categoryId"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const totalBy = new Map(all.map((a) => [a.categoryId, a._count._all]));
  const activeBy = new Map(active.map((a) => [a.categoryId, a._count._all]));
  return cats.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    total: totalBy.get(c.id) ?? 0,
    active: activeBy.get(c.id) ?? 0,
  }));
}

/** Values in one category with how many samples use each. */
export async function listValues(categoryCode: string) {
  const cat = await prisma.masterCategory.findUnique({ where: { code: categoryCode } });
  if (!cat || HIDDEN_CATEGORY_CODES.includes(cat.code)) return null;
  const values = await prisma.masterValue.findMany({
    where: { categoryId: cat.id, NOT: retiredPredefined },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: {
        select: {
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
          samplesAsDesignName: true,
          inwardsAsDesignName: true,
          productionsAsDesignName: true,
          bodyVeinDetailUses: true,
          formulationVeinDetailUses: true,
          inwardDesignMixerUses: true,
          inwardDesignVeinDetailUses: true,
          inwardDesignColourUses: true,
          sampleDesignMixerUses: true,
          sampleDesignVeinDetailUses: true,
          sampleDesignColourUses: true,
          formulationAdditiveUses: true,
        },
      },
    },
  });
  // Same position → alphabetical ignoring case.
  values.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.sortOrder - b.sortOrder || compareLabels(a.label, b.label));
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
          c.productionBodyPatternUses +
          c.samplesAsDesignName +
          c.inwardsAsDesignName +
          c.productionsAsDesignName +
          c.bodyVeinDetailUses +
          c.formulationVeinDetailUses +
          c.inwardDesignMixerUses +
          c.inwardDesignVeinDetailUses +
          c.inwardDesignColourUses +
          c.sampleDesignMixerUses +
          c.sampleDesignVeinDetailUses +
          c.sampleDesignColourUses +
          c.formulationAdditiveUses,
      };
    }),
  };
}

export type MasterValueRow = NonNullable<Awaited<ReturnType<typeof listValues>>>["values"][number];

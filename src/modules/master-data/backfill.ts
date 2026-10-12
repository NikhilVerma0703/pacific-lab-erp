/**
 * Moves values typed as free text — before their master list existed — into
 * the list, and points each record at the list value.
 *
 *  - Design Name / Sample Design Name  → Design Names
 *  - Vein details (each body, each Roy Body) → Vein Details
 *
 * One value per text, matched ignoring case and spaces, so "thin white" and
 * "Thin  White" become one value. Safe to run any number of times: only
 * records not moved yet are touched. Runs from `npm run db:seed` and, on an
 * install that has not re-run the seed, the first time the app creates the new
 * list (see `ensureCatalogCategories`).
 *
 * Also re-checks every value's normalised key, so matching stays
 * case-insensitive even for values stored by an older version.
 *
 * Shared by the seed script and the server, so no server-only imports.
 */
import type { PrismaClient } from "@prisma/client";
import { cleanLabel, normalizeKey } from "../../lib/normalize";
import { labelLimit, MASTER, type MasterCode } from "./catalog";

type Db = PrismaClient;

function valueIds(db: Db, code: MasterCode) {
  const ids = new Map<string, string>();
  let categoryId: string | null = null;
  /** The list value for this text (created when missing); null when the text cannot be a value. */
  return async (raw: string | null): Promise<string | null> => {
    const label = cleanLabel(raw ?? "");
    if (!label || label.length > labelLimit(code)) return null;
    const key = normalizeKey(label);
    if (!ids.has(key)) {
      categoryId ??= (await db.masterCategory.findUniqueOrThrow({ where: { code } })).id;
      const v = await db.masterValue.upsert({
        where: { categoryId_normalizedKey: { categoryId, normalizedKey: key } },
        update: {},
        create: { categoryId, label, normalizedKey: key, isActive: true },
      });
      ids.set(key, v.id);
    }
    return ids.get(key)!;
  };
}

export async function backfillDesignNames(db: Db) {
  const valueId = valueIds(db, MASTER.DESIGN_NAME);
  let moved = 0;
  let kept = 0;
  for (const s of await db.labSample.findMany({ where: { legacyDesignName: { not: null }, designNameId: null }, select: { id: true, legacyDesignName: true } })) {
    const id = await valueId(s.legacyDesignName);
    if (!id) { kept++; continue; }
    await db.labSample.update({ where: { id: s.id }, data: { designNameId: id, legacyDesignName: null } });
    moved++;
  }
  for (const s of await db.productionSample.findMany({ where: { legacyDesignName: { not: null }, designNameId: null }, select: { id: true, legacyDesignName: true } })) {
    const id = await valueId(s.legacyDesignName);
    if (!id) { kept++; continue; }
    await db.productionSample.update({ where: { id: s.id }, data: { designNameId: id, legacyDesignName: null } });
    moved++;
  }
  for (const e of await db.inwardOutwardEntry.findMany({ where: { legacySampleDesignName: { not: null }, designNameId: null }, select: { id: true, legacySampleDesignName: true } })) {
    const id = await valueId(e.legacySampleDesignName);
    if (!id) { kept++; continue; }
    await db.inwardOutwardEntry.update({ where: { id: e.id }, data: { designNameId: id, legacySampleDesignName: null } });
    moved++;
  }
  return { moved, kept };
}

export async function backfillVeinDetails(db: Db) {
  const valueId = valueIds(db, MASTER.VEIN_DETAIL);
  let moved = 0;
  let kept = 0;
  for (const b of await db.sampleBody.findMany({ where: { legacyVeinNotes: { not: null } }, select: { id: true, legacyVeinNotes: true } })) {
    const id = await valueId(b.legacyVeinNotes);
    if (!id) { kept++; continue; }
    await db.$transaction([
      db.sampleBodyVeinDetail.createMany({ data: [{ bodyId: b.id, detailId: id, sortOrder: 100 }], skipDuplicates: true }),
      db.sampleBody.update({ where: { id: b.id }, data: { legacyVeinNotes: null } }),
    ]);
    moved++;
  }
  for (const f of await db.formulation.findMany({ where: { legacyVeinNotes: { not: null } }, select: { id: true, legacyVeinNotes: true } })) {
    const id = await valueId(f.legacyVeinNotes);
    if (!id) { kept++; continue; }
    await db.$transaction([
      db.formulationVeinDetail.createMany({ data: [{ formulationId: f.id, detailId: id, sortOrder: 100 }], skipDuplicates: true }),
      db.formulation.update({ where: { id: f.id }, data: { legacyVeinNotes: null } }),
    ]);
    moved++;
  }
  // Samples saved before body-wise entry keep their one text (it is shown on
  // every body and becomes body rows when the sample is next saved) — but the
  // text is offered in the list from now on.
  for (const s of await db.labSample.findMany({ where: { veinNotes: { not: null } }, distinct: ["veinNotes"], select: { veinNotes: true } })) {
    await valueId(s.veinNotes);
  }
  return { moved, kept };
}

/** Values whose stored key is not the case-/space-insensitive key of their label. */
export async function normalizeMasterKeys(db: Db) {
  let fixed = 0;
  const clashes: string[] = [];
  for (const v of await db.masterValue.findMany({ select: { id: true, label: true, normalizedKey: true, categoryId: true } })) {
    const key = normalizeKey(v.label);
    if (key === v.normalizedKey) continue;
    const twin = await db.masterValue.findUnique({ where: { categoryId_normalizedKey: { categoryId: v.categoryId, normalizedKey: key } } });
    if (twin) {
      clashes.push(`“${v.label}” / “${twin.label}”`);
      continue;
    }
    await db.masterValue.update({ where: { id: v.id }, data: { normalizedKey: key } });
    fixed++;
  }
  return { fixed, clashes };
}

/** Everything above; returns one line per thing that happened (for logs). */
export async function backfillTypedValues(db: Db): Promise<string[]> {
  const out: string[] = [];
  const keys = await normalizeMasterKeys(db);
  if (keys.fixed) out.push(`Master data: corrected the matching key of ${keys.fixed} value(s).`);
  if (keys.clashes.length) out.push(`Master data: values that differ only by case (disable one of each pair in Master Data): ${keys.clashes.join(", ")}.`);
  const names = await backfillDesignNames(db);
  if (names.moved) out.push(`Design Names: moved ${names.moved} typed design name(s) into the list.`);
  if (names.kept) out.push(`Design Names: ${names.kept} name(s) too long for the list were left as typed.`);
  const vein = await backfillVeinDetails(db);
  if (vein.moved) out.push(`Vein Details: moved ${vein.moved} typed vein detail(s) into the list.`);
  if (vein.kept) out.push(`Vein Details: ${vein.kept} detail(s) too long for the list were left as typed.`);
  return out;
}

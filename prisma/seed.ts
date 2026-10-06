/**
 * Seed: master lists + the first admin account.
 *
 * Idempotent — safe to run any number of times. Existing values are never
 * renamed or re-enabled, so edits made in the Master Data screen survive.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { CATALOG, catalogSortOrder, MASTER, RETIRED_CATEGORY_CODES } from "../src/modules/master-data/catalog";
import { cleanLabel, MAX_LABEL_LENGTH, normalizeKey } from "../src/lib/normalize";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Design Name was free text before the Design Names list existed. Move every
 * typed name into the list (one value per name, ignoring case / spaces) and
 * point the record at it. Safe to re-run: only records not moved yet are touched.
 */
async function backfillDesignNames() {
  const cat = await prisma.masterCategory.findUniqueOrThrow({ where: { code: MASTER.DESIGN_NAME } });
  const ids = new Map<string, string>();
  const valueId = async (raw: string): Promise<string | null> => {
    const label = cleanLabel(raw);
    if (!label || label.length > MAX_LABEL_LENGTH) return null;
    const key = normalizeKey(label);
    if (!ids.has(key)) {
      const v = await prisma.masterValue.upsert({
        where: { categoryId_normalizedKey: { categoryId: cat.id, normalizedKey: key } },
        update: {},
        create: { categoryId: cat.id, label, normalizedKey: key, isActive: true },
      });
      ids.set(key, v.id);
    }
    return ids.get(key)!;
  };

  let moved = 0;
  let kept = 0;
  for (const s of await prisma.labSample.findMany({ where: { legacyDesignName: { not: null }, designNameId: null }, select: { id: true, legacyDesignName: true } })) {
    const id = await valueId(s.legacyDesignName!);
    if (!id) { kept++; continue; }
    await prisma.labSample.update({ where: { id: s.id }, data: { designNameId: id, legacyDesignName: null } });
    moved++;
  }
  for (const s of await prisma.productionSample.findMany({ where: { legacyDesignName: { not: null }, designNameId: null }, select: { id: true, legacyDesignName: true } })) {
    const id = await valueId(s.legacyDesignName!);
    if (!id) { kept++; continue; }
    await prisma.productionSample.update({ where: { id: s.id }, data: { designNameId: id, legacyDesignName: null } });
    moved++;
  }
  for (const e of await prisma.inwardOutwardEntry.findMany({ where: { legacySampleDesignName: { not: null }, designNameId: null }, select: { id: true, legacySampleDesignName: true } })) {
    const id = await valueId(e.legacySampleDesignName!);
    if (!id) { kept++; continue; }
    await prisma.inwardOutwardEntry.update({ where: { id: e.id }, data: { designNameId: id, legacySampleDesignName: null } });
    moved++;
  }
  if (moved) console.log(`Design Names: moved ${moved} typed design name(s) into the list (${ids.size} name(s)).`);
  if (kept) console.log(`Design Names: ${kept} name(s) longer than ${MAX_LABEL_LENGTH} characters were left as typed.`);
}

async function main() {
  for (const [i, entry] of CATALOG.entries()) {
    const category = await prisma.masterCategory.upsert({
      where: { code: entry.code },
      update: {},
      create: {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        sortOrder: catalogSortOrder(entry, i),
      },
    });

    for (const [j, v] of entry.values.entries()) {
      const key = normalizeKey(v.label);
      const existing = await prisma.masterValue.findUnique({
        where: { categoryId_normalizedKey: { categoryId: category.id, normalizedKey: key } },
      });
      if (existing) {
        // Attach a behaviour code to a value that was created by hand earlier.
        if (v.code && !existing.code) {
          await prisma.masterValue.update({ where: { id: existing.id }, data: { code: v.code } });
        }
        continue;
      }
      await prisma.masterValue.create({
        data: {
          categoryId: category.id,
          label: cleanLabel(v.label),
          normalizedKey: key,
          code: v.code ?? null,
          isSystem: true,
          sortOrder: (j + 1) * 10,
        },
      });
    }
  }

  // Lists the ERP no longer uses (e.g. Sample Types): removed once nothing refers to them.
  for (const code of RETIRED_CATEGORY_CODES) {
    const cat = await prisma.masterCategory.findUnique({ where: { code } });
    if (!cat) continue;
    try {
      await prisma.$transaction([
        prisma.masterValue.deleteMany({ where: { categoryId: cat.id } }),
        prisma.masterCategory.delete({ where: { id: cat.id } }),
      ]);
      console.log(`Removed retired list ${code}.`);
    } catch {
      console.log(`Retired list ${code} is still referenced — run "npx prisma db push" first; it stays hidden meanwhile.`);
    }
  }

  await backfillDesignNames();

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@pacific-surfaces.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const exists = await prisma.user.findUnique({ where: { email } });
  if (!exists) {
    await prisma.user.create({
      data: {
        email,
        name: process.env.SEED_ADMIN_NAME ?? "Lab Admin",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Created admin user ${email}`);
  } else {
    console.log(`Admin user ${email} already exists — password unchanged`);
  }

  const counts = await prisma.masterValue.count();
  console.log(`Master data ready: ${CATALOG.length} lists, ${counts} values.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

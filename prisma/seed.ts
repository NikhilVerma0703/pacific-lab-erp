/**
 * Seed: master lists + the first admin account.
 *
 * Idempotent — safe to run any number of times. Existing values are never
 * renamed or re-enabled, so edits made in the Master Data screen survive.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { CATALOG } from "../src/modules/master-data/catalog";
import { cleanLabel, normalizeKey } from "../src/lib/normalize";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  for (const [i, entry] of CATALOG.entries()) {
    const category = await prisma.masterCategory.upsert({
      where: { code: entry.code },
      update: {},
      create: {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        sortOrder: (i + 1) * 10,
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

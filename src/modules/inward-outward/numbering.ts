import "server-only";
import { prisma, type Tx } from "@/lib/db";

/**
 * Inward / Outward S.No. and Slab Number — their own series, with the same
 * rules as the other forms:
 *  - S.No.        highest existing + 1
 *  - Slab Number  the most recent entry's slab + 1, skipping numbers already used
 * Saves take a transaction-scoped advisory lock; the unique constraints are
 * the final guarantee.
 */
const LOCK_KEY = 4_471_002; // "inward / outward numbering"

type Db = Tx | typeof prisma;

export async function lockInwardNumbering(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
}

export async function nextInwardSerial(db: Db): Promise<number> {
  const agg = await db.inwardOutwardEntry.aggregate({ _max: { serialNo: true } });
  return (agg._max.serialNo ?? 0) + 1;
}

export async function nextInwardSlab(db: Db): Promise<number> {
  const last = await db.inwardOutwardEntry.findFirst({
    where: { slabNumber: { not: null } },
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    select: { slabNumber: true },
  });
  let candidate = last?.slabNumber != null ? last.slabNumber + 1 : 1;
  for (let guard = 0; guard < 100; guard++) {
    const window = Array.from({ length: 50 }, (_, i) => candidate + i);
    const taken = new Set(
      (await db.inwardOutwardEntry.findMany({ where: { slabNumber: { in: window } }, select: { slabNumber: true } })).map((r) => r.slabNumber),
    );
    const free = window.find((n) => !taken.has(n));
    if (free !== undefined) return free;
    candidate = window[window.length - 1] + 1;
  }
  throw new Error("Could not find a free slab number.");
}

export async function suggestInwardNumbers(): Promise<{ serialNo: number; slabNumber: number }> {
  const [serialNo, slabNumber] = await Promise.all([nextInwardSerial(prisma), nextInwardSlab(prisma)]);
  return { serialNo, slabNumber };
}

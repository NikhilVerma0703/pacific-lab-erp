import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { NUMBERING } from "@/modules/samples/numbering";

/**
 * Production Sample S.No. and Slab Number — their own series, separate from
 * lab samples, with the same rules:
 *  - S.No.        highest existing + 1
 *  - Slab Number  the most recent entry's slab + 1, skipping numbers already used
 * Saves take a transaction-scoped advisory lock; the unique constraints are
 * the final guarantee.
 */
const LOCK_KEY = 4_471_003; // "production sample numbering"

type Db = Tx | typeof prisma;

export async function lockProductionNumbering(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
}

export async function nextProductionSerial(db: Db): Promise<number> {
  const agg = await db.productionSample.aggregate({ _max: { serialNo: true } });
  return (agg._max.serialNo ?? NUMBERING.serialStart - NUMBERING.step) + NUMBERING.step;
}

export async function nextProductionSlab(db: Db): Promise<number> {
  const last = await db.productionSample.findFirst({
    where: { slabNumber: { not: null } },
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    select: { slabNumber: true },
  });
  let candidate = last?.slabNumber != null ? last.slabNumber + NUMBERING.step : NUMBERING.slabStart;
  for (let guard = 0; guard < 100; guard++) {
    const window = Array.from({ length: 50 }, (_, i) => candidate + i * NUMBERING.step);
    const taken = new Set(
      (await db.productionSample.findMany({ where: { slabNumber: { in: window } }, select: { slabNumber: true } })).map((r) => r.slabNumber),
    );
    const free = window.find((n) => !taken.has(n));
    if (free !== undefined) return free;
    candidate = window[window.length - 1] + NUMBERING.step;
  }
  throw new Error("Could not find a free slab number.");
}

export async function suggestProductionNumbers(): Promise<{ serialNo: number; slabNumber: number }> {
  const [serialNo, slabNumber] = await Promise.all([nextProductionSerial(prisma), nextProductionSlab(prisma)]);
  return { serialNo, slabNumber };
}

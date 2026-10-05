import "server-only";
import { prisma, type Tx } from "@/lib/db";

/**
 * S.No. and Slab Number allocation.
 *
 * Kept in one module so the rule can become configurable (start value, step,
 * per-year reset, prefixes) without touching the form or the save logic.
 *
 *  - S.No.        highest existing + 1
 *  - Slab Number  the most recent sample's slab + 1, skipping any number that
 *                 is already taken (e.g. one typed in by hand earlier)
 *
 * Allocation inside a save takes a transaction-scoped advisory lock, so two
 * people saving at the same moment cannot receive the same number; the unique
 * constraints on LabSample are the final guarantee.
 */
export const NUMBERING = {
  serialStart: 1,
  slabStart: 1,
  step: 1,
} as const;

const LOCK_KEY = 4_471_001; // arbitrary, app-wide: "sample numbering"

type Db = Tx | typeof prisma;

export async function lockNumbering(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
}

export async function nextSerialNo(db: Db): Promise<number> {
  const agg = await db.labSample.aggregate({ _max: { serialNo: true } });
  return (agg._max.serialNo ?? NUMBERING.serialStart - NUMBERING.step) + NUMBERING.step;
}

export async function nextSlabNumber(db: Db): Promise<number> {
  const last = await db.labSample.findFirst({
    where: { slabNumber: { not: null } },
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    select: { slabNumber: true },
  });
  let candidate = last?.slabNumber != null ? last.slabNumber + NUMBERING.step : NUMBERING.slabStart;
  // Skip numbers already used. Bounded: one query per batch of 50.
  for (let guard = 0; guard < 100; guard++) {
    const window = Array.from({ length: 50 }, (_, i) => candidate + i * NUMBERING.step);
    const taken = new Set(
      (
        await db.labSample.findMany({
          where: { slabNumber: { in: window } },
          select: { slabNumber: true },
        })
      ).map((r) => r.slabNumber),
    );
    const free = window.find((n) => !taken.has(n));
    if (free !== undefined) return free;
    candidate = window[window.length - 1] + NUMBERING.step;
  }
  throw new Error("Could not find a free slab number.");
}

export async function suggestNumbers(): Promise<{ serialNo: number; slabNumber: number }> {
  const [serialNo, slabNumber] = await Promise.all([nextSerialNo(prisma), nextSlabNumber(prisma)]);
  return { serialNo, slabNumber };
}

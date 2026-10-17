import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { dateOnly, numbersFor, renumberDate, type NumberingTable } from "@/modules/forms/date-numbering";

/**
 * Production Sample S.No. and Slab Number — by date, over production samples only (rules in
 * `modules/forms/date-numbering.ts`). Saves take a transaction-scoped
 * advisory lock; (date, S.No.) and Slab Number are unique in the database.
 */
const LOCK_KEY = 4_471_003; // "production sample numbering"

export async function lockProductionNumbering(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
}

export const productionNumbering: NumberingTable = {
  onDate: (tx, date) =>
    tx.productionSample.findMany({
      where: { sampleDate: date },
      select: { id: true, serialNo: true, slabNumber: true },
      orderBy: [{ serialNo: "asc" }, { createdAt: "asc" }],
    }),
  slabOwner: async (tx, slab) => {
    const r = await tx.productionSample.findFirst({ where: { slabNumber: slab }, select: { id: true, serialNo: true, sampleDate: true } });
    return r ? { id: r.id, serialNo: r.serialNo, date: r.sampleDate } : null;
  },
  setSerial: async (tx, id, serialNo) => {
    await tx.productionSample.update({ where: { id }, data: { serialNo } });
  },
};

/** The S.No. and starting Slab Number the form shows for a date (YYYY-MM-DD; today when blank). */
export async function suggestProductionNumbers(date?: string | null, excludeId?: string) {
  const d = dateOnly(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : plantToday());
  return prisma.$transaction((tx) => numbersFor(productionNumbering, tx, d, excludeId));
}

/** Close the gaps in a date's S.No. (after a delete or a move to another date). */
export const renumberProductionDate = (tx: Tx, date: Date) => renumberDate(productionNumbering, tx, date);

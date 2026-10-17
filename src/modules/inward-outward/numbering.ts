import "server-only";
import { prisma, type Tx } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { dateOnly, numbersFor, renumberDate, type NumberingTable } from "@/modules/forms/date-numbering";

/**
 * Sample Inward / Outward S.No. and Slab Number — by date, over inward / outward entries only (rules in
 * `modules/forms/date-numbering.ts`). Saves take a transaction-scoped
 * advisory lock; (date, S.No.) and Slab Number are unique in the database.
 */
const LOCK_KEY = 4_471_002; // "inward / outward numbering"

export async function lockInwardNumbering(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
}

export const inwardNumbering: NumberingTable = {
  onDate: (tx, date) =>
    tx.inwardOutwardEntry.findMany({
      where: { entryDate: date },
      select: { id: true, serialNo: true, slabNumber: true },
      orderBy: [{ serialNo: "asc" }, { createdAt: "asc" }],
    }),
  slabOwner: async (tx, slab) => {
    const r = await tx.inwardOutwardEntry.findFirst({ where: { slabNumber: slab }, select: { id: true, serialNo: true, entryDate: true } });
    return r ? { id: r.id, serialNo: r.serialNo, date: r.entryDate } : null;
  },
  setSerial: async (tx, id, serialNo) => {
    await tx.inwardOutwardEntry.update({ where: { id }, data: { serialNo } });
  },
};

/** The S.No. and starting Slab Number the form shows for a date (YYYY-MM-DD; today when blank). */
export async function suggestInwardNumbers(date?: string | null, excludeId?: string) {
  const d = dateOnly(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : plantToday());
  return prisma.$transaction((tx) => numbersFor(inwardNumbering, tx, d, excludeId));
}

/** Close the gaps in a date's S.No. (after a delete or a move to another date). */
export const renumberInwardDate = (tx: Tx, date: Date) => renumberDate(inwardNumbering, tx, date);

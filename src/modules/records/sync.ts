import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { lockInwardNumbering, renumberInwardDate } from "@/modules/inward-outward/numbering";
import { syncInwardRecords, writeInwardRecord } from "@/modules/inward-outward/record-store";
import { lockProductionNumbering, renumberProductionDate } from "@/modules/production/numbering";
import { lockLabNumbering, renumberLabDate } from "@/modules/samples/numbering";
import { syncLabRecords, writeLabRecord } from "@/modules/samples/record-store";

let synced: Promise<void> | null = null;

/**
 * Keep saved data consistent with the current rules — once per server
 * process, on the first page visit:
 *  1. S.No. runs 1, 2, 3 … within each date in every form. Records saved
 *     before (one running S.No. across all dates) are renumbered per date in
 *     the order they were saved; Slab Numbers are not touched.
 *  2. The Lab Sample and Sample Inward / Outward databases hold an
 *     up-to-date copy of every record.
 */
export function ensureRecordStores(): Promise<void> {
  synced ??= (async () => {
    const renumbered = await renumberAllDates();
    const lab = await syncLabRecords();
    const inward = await syncInwardRecords();
    if (renumbered) console.log(`numbering: S.No. renumbered per date on ${renumbered} date(s)`);
    if (lab || inward) console.log(`record stores: ${lab} lab sample(s), ${inward} inward / outward entr${inward === 1 ? "y" : "ies"} copied`);
  })().catch((e) => {
    synced = null;
    console.error("record stores", e);
  });
  return synced;
}

/** Dates whose S.No. are not exactly 1 … k. */
async function gappedDates(table: "LabSample" | "InwardOutwardEntry" | "ProductionSample", column: "sampleDate" | "entryDate"): Promise<Date[]> {
  const rows = await prisma.$queryRaw<{ d: Date }[]>(
    Prisma.sql`SELECT ${Prisma.raw(`"${column}"`)} AS d FROM ${Prisma.raw(`"${table}"`)} GROUP BY 1 HAVING MIN("serialNo") <> 1 OR MAX("serialNo") <> COUNT(*)`,
  );
  return rows.map((r) => r.d);
}

async function renumberAllDates(): Promise<number> {
  let count = 0;
  const run = async (dates: Date[], lock: (tx: Tx) => Promise<void>, renumber: (tx: Tx, d: Date) => Promise<string[]>, refresh: (tx: Tx, ids: string[]) => Promise<void>) => {
    for (const d of dates) {
      await prisma.$transaction(
        async (tx) => {
          await lock(tx);
          await refresh(tx, await renumber(tx, d));
        },
        { timeout: 60_000 },
      );
      count++;
    }
  };
  await run(await gappedDates("LabSample", "sampleDate"), lockLabNumbering, renumberLabDate, async (tx, ids) => {
    for (const id of ids) {
      await writeLabRecord(tx, id);
      const inward = await tx.inwardOutwardEntry.findFirst({ where: { labSampleId: id }, select: { id: true } });
      if (inward) await writeInwardRecord(tx, inward.id);
    }
  });
  await run(await gappedDates("InwardOutwardEntry", "entryDate"), lockInwardNumbering, renumberInwardDate, async (tx, ids) => {
    for (const id of ids) await writeInwardRecord(tx, id);
  });
  await run(await gappedDates("ProductionSample", "sampleDate"), lockProductionNumbering, renumberProductionDate, async () => {});
  return count;
}

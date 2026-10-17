import "server-only";
import type { Tx } from "@/lib/db";

/**
 * S.No. and Slab Number by date — the same rules for the Lab Sample, Sample
 * Inward / Outward and Production Sample forms, each over its own records:
 *
 *  - S.No. runs 1, 2, 3 … within each date (the record's own Date), in the
 *    order records are saved. Picking another date numbers within that date,
 *    so back-dated entries never touch today's sequence.
 *  - Slab Number: the first entry of a date (S.No. 1) is typed by hand; each
 *    later entry of that date gets the previous entry's slab + 1 (skipping a
 *    number already used).
 *  - Numbers come from the saved records, inside the save transaction under
 *    the form's advisory lock; (date, S.No.) is unique in the database.
 *  - Deleting a record, or moving it to another date, renumbers the rest of
 *    that date so S.No. stays 1 … k with no gaps (Slab Numbers never change).
 */

export interface NumberedRow {
  id: string;
  serialNo: number;
  slabNumber: number | null;
}

/** One form's records, as the numbering needs them. */
export interface NumberingTable {
  /** Records of that date, by S.No. (then save order). */
  onDate(tx: Tx, date: Date): Promise<NumberedRow[]>;
  /** The record holding a slab number, if any. */
  slabOwner(tx: Tx, slab: number): Promise<{ id: string; serialNo: number; date: Date } | null>;
  setSerial(tx: Tx, id: string, serialNo: number): Promise<void>;
}

/** YYYY-MM-DD → the DATE value stored. */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** Next S.No. on a date (1 when nothing is saved for it). */
export async function nextSerialOn(t: NumberingTable, tx: Tx, date: Date, excludeId?: string): Promise<number> {
  const rows = (await t.onDate(tx, date)).filter((r) => r.id !== excludeId);
  return rows.length ? Math.max(...rows.map((r) => r.serialNo)) + 1 : 1;
}

/**
 * Slab Number for the next entry of a date: the previous entry's slab + 1
 * (the next free one). Null for the first entry of the date, or when the
 * previous entry has no slab — then it is typed by hand.
 */
export async function suggestedSlabOn(t: NumberingTable, tx: Tx, date: Date, excludeId?: string): Promise<number | null> {
  const rows = (await t.onDate(tx, date)).filter((r) => r.id !== excludeId);
  if (!rows.length) return null;
  const previous = rows.reduce((a, b) => (b.serialNo > a.serialNo ? b : a));
  if (previous.slabNumber === null) return null;
  for (let s = previous.slabNumber + 1, guard = 0; guard < 1000; s++, guard++) {
    const owner = await t.slabOwner(tx, s);
    if (!owner || owner.id === excludeId) return s;
  }
  return null;
}

/** What the form shows for a date: the S.No. it will get and the Slab Number to start from. */
export async function numbersFor(t: NumberingTable, tx: Tx, date: Date, excludeId?: string) {
  const rows = (await t.onDate(tx, date)).filter((r) => r.id !== excludeId);
  return {
    serialNo: await nextSerialOn(t, tx, date, excludeId),
    slabNumber: await suggestedSlabOn(t, tx, date, excludeId),
    /** No other record on this date: the Slab Number is typed by hand. */
    first: rows.length === 0,
  };
}

/** Make a date's S.No. 1 … k again (after a delete or a move). Returns the ids that changed. */
export async function renumberDate(t: NumberingTable, tx: Tx, date: Date): Promise<string[]> {
  const rows = await t.onDate(tx, date);
  const changed = rows.filter((r, i) => r.serialNo !== i + 1);
  if (!changed.length) return [];
  // Free the numbers first, so no two records ever share one on that date.
  for (const r of changed) await t.setSerial(tx, r.id, -Math.abs(r.serialNo) - 1_000_000);
  for (const [i, r] of rows.entries()) if (r.serialNo !== i + 1) await t.setSerial(tx, r.id, i + 1);
  return changed.map((r) => r.id);
}

/** "Slab 5100 is already used by S.No. 3 (12 Oct 2026)." */
export function slabTakenMessage(slab: number, owner: { serialNo: number; date: Date }) {
  const d = owner.date.toISOString().slice(0, 10).split("-").reverse().join("-");
  return `Slab ${slab} is already used by S.No. ${owner.serialNo} of ${d}.`;
}

/**
 * The numbers a save writes, inside the save transaction (lock held):
 *  - S.No.: kept on an edit that keeps the date; otherwise the next on the date.
 *  - Slab Number: on a new record, the typed value for the first entry of the
 *    date (or for roles allowed to type numbers), else the previous entry's
 *    slab + 1 — also when the form still shows that untouched suggestion
 *    (`autoSlab`), so two people saving at once never collide. On an edit, the
 *    typed value for roles allowed to type numbers, else unchanged.
 */
export async function allocateNumbers(
  t: NumberingTable,
  tx: Tx,
  args: {
    date: Date;
    existing: { id: string; date: Date; serialNo: number; slabNumber: number | null } | null;
    typedSlab: number | null;
    autoSlab: boolean;
    canOverride: boolean;
  },
): Promise<{ serialNo: number; slabNumber: number | null; moved: boolean; fieldErrors: Record<string, string> }> {
  const { date, existing, typedSlab, autoSlab, canOverride } = args;
  const moved = !!existing && existing.date.getTime() !== date.getTime();
  const serialNo = existing && !moved ? existing.serialNo : await nextSerialOn(t, tx, date, existing?.id);
  let slabNumber: number | null;
  if (existing) slabNumber = canOverride ? typedSlab : existing.slabNumber;
  else {
    const first = (await t.onDate(tx, date)).length === 0;
    slabNumber = !autoSlab && (canOverride || first) ? typedSlab : await suggestedSlabOn(t, tx, date);
  }
  const fieldErrors: Record<string, string> = {};
  if (slabNumber !== null) {
    const owner = await t.slabOwner(tx, slabNumber);
    if (owner && owner.id !== existing?.id) fieldErrors.slabNumber = slabTakenMessage(slabNumber, owner);
  }
  return { serialNo, slabNumber, moved, fieldErrors };
}

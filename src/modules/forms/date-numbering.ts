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
 *  - Both numbers are suggestions: they can be typed over before saving. A
 *    typed S.No. puts the record at that place in its date and moves the ones
 *    after it down, so the date still reads 1 … k with no gaps and no twins;
 *    a number beyond the date's last entry becomes that last place.
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

/** Out of the way while a date is being renumbered (negative numbers are never real S.No.). */
const parked = (serialNo: number) => -Math.abs(serialNo) - 1_000_000;

/** Make a date's S.No. 1 … k again (after a delete or a move). Returns the ids that changed. */
export async function renumberDate(t: NumberingTable, tx: Tx, date: Date): Promise<string[]> {
  const rows = await t.onDate(tx, date);
  const changed = rows.filter((r, i) => r.serialNo !== i + 1);
  if (!changed.length) return [];
  // Free the numbers first, so no two records ever share one on that date.
  for (const r of changed) await t.setSerial(tx, r.id, parked(r.serialNo));
  for (const [i, r] of rows.entries()) if (r.serialNo !== i + 1) await t.setSerial(tx, r.id, i + 1);
  return changed.map((r) => r.id);
}

/** "Slab 5100 is already used by S.No. 3 (12 Oct 2026)." */
export function slabTakenMessage(slab: number, owner: { serialNo: number; date: Date }) {
  const d = owner.date.toISOString().slice(0, 10).split("-").reverse().join("-");
  return `Slab ${slab} is already used by S.No. ${owner.serialNo} of ${d}.`;
}

/**
 * Put a record at `position` within its date and give every other record of
 * that date its place around it (1 … k, in order). Numbers are parked in the
 * negatives first, so no two records ever hold the same S.No. on that date.
 * Returns the other records that changed.
 */
async function placeInDate(
  t: NumberingTable,
  tx: Tx,
  args: { position: number; others: NumberedRow[]; movingId?: string; movingFrom?: number },
): Promise<string[]> {
  const { position, others, movingId, movingFrom } = args;
  const moves = others
    .map((r, i) => ({ row: r, to: i + 1 < position ? i + 1 : i + 2 }))
    .filter((m) => m.row.serialNo !== m.to);
  const selfMoves = movingId !== undefined && movingFrom !== undefined && movingFrom !== position;
  if (!moves.length && !selfMoves) return [];
  if (movingId !== undefined && movingFrom !== undefined) await t.setSerial(tx, movingId, parked(movingFrom));
  for (const m of moves) await t.setSerial(tx, m.row.id, parked(m.row.serialNo));
  for (const m of moves) await t.setSerial(tx, m.row.id, m.to);
  return moves.map((m) => m.row.id);
}

/**
 * The numbers a save writes, inside the save transaction (lock held). Both
 * fields are filled in by the form and can be typed over:
 *
 *  - S.No.: the typed number, kept within 1 … (entries of that date + 1); the
 *    records at and after it move down one place. Untouched, a new record goes
 *    last on its date (re-read here, so two people saving at once never land on
 *    the same number) and an edit keeps the S.No. it has.
 *  - Slab Number: the typed number; untouched (`autoSlab`), a new record takes
 *    the previous entry's slab + 1 at save time. An edit keeps its slab unless
 *    another number is typed. A slab already used by another record is refused.
 */
export async function allocateNumbers(
  t: NumberingTable,
  tx: Tx,
  args: {
    date: Date;
    existing: { id: string; date: Date; serialNo: number; slabNumber: number | null } | null;
    typedSerial: number | null;
    /** The form still shows the suggested S.No. (nobody typed over it). */
    autoSerial: boolean;
    typedSlab: number | null;
    autoSlab: boolean;
    /** This role may type S.No. and Slab Number instead of taking the suggestions. */
    canOverride: boolean;
  },
): Promise<{
  serialNo: number;
  slabNumber: number | null;
  moved: boolean;
  /** Other records of the date whose S.No. shifted (their copies need refreshing). */
  reordered: string[];
  /** Said back to the user when a typed number could not be used as such. */
  notes: string[];
  fieldErrors: Record<string, string>;
}> {
  const { date, existing, typedSerial, autoSerial, typedSlab, autoSlab, canOverride } = args;
  const moved = !!existing && existing.date.getTime() !== date.getTime();
  const notes: string[] = [];

  // ── S.No. ────────────────────────────────────────────────────────────────
  const others = (await t.onDate(tx, date)).filter((r) => r.id !== existing?.id);
  const last = others.length + 1;
  const stays = !!existing && !moved;
  let serialNo = stays ? existing.serialNo : last;
  if (canOverride && !autoSerial && typedSerial !== null) {
    serialNo = Math.min(Math.max(typedSerial, 1), last);
    if (serialNo !== typedSerial) notes.push(`S.No. ${typedSerial} is past the last entry of this date — saved as ${serialNo}.`);
  }
  const reordered = await placeInDate(t, tx, {
    position: serialNo,
    others,
    movingId: stays ? existing.id : undefined,
    movingFrom: stays ? existing.serialNo : undefined,
  });

  // ── Slab Number ──────────────────────────────────────────────────────────
  let slabNumber: number | null;
  if (!canOverride) slabNumber = existing ? existing.slabNumber : await suggestedSlabOn(t, tx, date);
  else if (autoSlab) slabNumber = existing && !moved ? existing.slabNumber : await suggestedSlabOn(t, tx, date);
  else slabNumber = typedSlab;

  const fieldErrors: Record<string, string> = {};
  if (slabNumber !== null) {
    const owner = await t.slabOwner(tx, slabNumber);
    if (owner && owner.id !== existing?.id) fieldErrors.slabNumber = slabTakenMessage(slabNumber, owner);
  }
  return { serialNo, slabNumber, moved, reordered, notes, fieldErrors };
}

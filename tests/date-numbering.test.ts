import { beforeEach, describe, expect, it } from "vitest";
import { allocateNumbers, dateOnly, numbersFor, renumberDate, type NumberedRow, type NumberingTable } from "@/modules/forms/date-numbering";
import type { Tx } from "@/lib/db";

/** One form's records, in memory: the numbering only asks for these three things. */
interface Row extends NumberedRow {
  date: string;
}
let rows: Row[] = [];

const table: NumberingTable = {
  onDate: async (_tx, date) =>
    rows
      .filter((r) => r.date === date.toISOString().slice(0, 10))
      .sort((a, b) => a.serialNo - b.serialNo)
      .map((r) => ({ id: r.id, serialNo: r.serialNo, slabNumber: r.slabNumber })),
  slabOwner: async (_tx, slab) => {
    const r = rows.find((x) => x.slabNumber === slab);
    return r ? { id: r.id, serialNo: r.serialNo, date: dateOnly(r.date) } : null;
  },
  setSerial: async (_tx, id, serialNo) => {
    rows.find((r) => r.id === id)!.serialNo = serialNo;
  },
};

const tx = {} as Tx;
const DAY = "2026-10-18";
const OTHER = "2026-10-17";
const row = (id: string, serialNo: number, slabNumber: number | null, date = DAY): Row => ({ id, serialNo, slabNumber, date });
/** "a:1/5001, b:2/5002" — the date's records in order. */
const onDate = (date = DAY) =>
  rows
    .filter((r) => r.date === date)
    .sort((a, b) => a.serialNo - b.serialNo)
    .map((r) => `${r.id}:${r.serialNo}/${r.slabNumber ?? "-"}`)
    .join(", ");

const save = async (args: Partial<Parameters<typeof allocateNumbers>[2]> = {}) =>
  allocateNumbers(table, tx, { date: dateOnly(DAY), existing: null, typedSerial: null, autoSerial: true, typedSlab: null, autoSlab: true, canOverride: true, ...args });

const existingOf = (id: string) => {
  const r = rows.find((x) => x.id === id)!;
  return { id: r.id, date: dateOnly(r.date), serialNo: r.serialNo, slabNumber: r.slabNumber };
};

beforeEach(() => {
  rows = [row("a", 1, 5001), row("b", 2, 5002), row("c", 3, 5003), row("x", 1, 4001, OTHER)];
});

describe("S.No. and Slab Number by date", () => {
  it("suggests the next S.No. and the previous Slab Number + 1", async () => {
    expect(await numbersFor(table, tx, dateOnly(DAY))).toEqual({ serialNo: 4, slabNumber: 5004, first: false });
    expect(await numbersFor(table, tx, dateOnly("2026-10-20"))).toEqual({ serialNo: 1, slabNumber: null, first: true });
    const r = await save();
    expect([r.serialNo, r.slabNumber, r.reordered, r.notes]).toEqual([4, 5004, [], []]);
  });

  it("keeps a typed S.No. and moves the entries after it down", async () => {
    const r = await save({ autoSerial: false, typedSerial: 2, autoSlab: false, typedSlab: 7777 });
    expect([r.serialNo, r.slabNumber]).toEqual([2, 7777]);
    expect(r.reordered.sort()).toEqual(["b", "c"]);
    // The new record takes 2; b and c follow it.
    expect(onDate()).toBe("a:1/5001, b:3/5002, c:4/5003");
  });

  it("a typed S.No. past the last entry becomes the last place, and says so", async () => {
    const r = await save({ autoSerial: false, typedSerial: 99 });
    expect([r.serialNo, r.reordered]).toEqual([4, []]);
    expect(r.notes[0]).toContain("saved as 4");
    const low = await save({ autoSerial: false, typedSerial: 0 });
    expect(low.serialNo).toBe(1);
  });

  it("a typed Slab Number already used is refused", async () => {
    const r = await save({ autoSlab: false, typedSlab: 5002 });
    expect(r.fieldErrors.slabNumber).toContain("already used by S.No. 2");
    // Its own slab on an edit is not a clash.
    const own = await save({ existing: existingOf("b"), autoSlab: false, typedSlab: 5002 });
    expect(own.fieldErrors).toEqual({});
  });

  it("an edit keeps its numbers, and can be moved to another place in the date", async () => {
    const same = await save({ existing: existingOf("c"), autoSerial: false, typedSerial: 3, autoSlab: false, typedSlab: 5003 });
    expect([same.serialNo, same.slabNumber, same.reordered, same.moved]).toEqual([3, 5003, [], false]);
    expect(onDate()).toBe("a:1/5001, b:2/5002, c:3/5003");

    const up = await save({ existing: existingOf("c"), autoSerial: false, typedSerial: 1, autoSlab: false, typedSlab: 5003 });
    expect(up.serialNo).toBe(1);
    rows.find((r) => r.id === "c")!.serialNo = up.serialNo; // the save writes the record itself
    expect(onDate()).toBe("c:1/5003, a:2/5001, b:3/5002");
  });

  it("an edit can be given another Slab Number; S.No. stays unless typed", async () => {
    const r = await save({ existing: existingOf("b"), autoSerial: true, typedSerial: 2, autoSlab: false, typedSlab: 9100 });
    expect([r.serialNo, r.slabNumber, r.reordered]).toEqual([2, 9100, []]);
  });

  it("moving to another date numbers within that date", async () => {
    const r = await save({ date: dateOnly(OTHER), existing: existingOf("b"), autoSerial: true, autoSlab: true });
    expect([r.serialNo, r.moved]).toEqual([2, true]);
    const typed = await save({ date: dateOnly(OTHER), existing: existingOf("b"), autoSerial: false, typedSerial: 1, autoSlab: true });
    expect([typed.serialNo, typed.reordered]).toEqual([1, ["x"]]);
  });

  it("a role that may not type numbers gets the suggestions", async () => {
    const r = await save({ canOverride: false, autoSerial: false, typedSerial: 1, autoSlab: false, typedSlab: 1234 });
    expect([r.serialNo, r.slabNumber]).toEqual([4, 5004]);
    const edit = await save({ canOverride: false, existing: existingOf("a"), autoSerial: false, typedSerial: 3, autoSlab: false, typedSlab: 1234 });
    expect([edit.serialNo, edit.slabNumber]).toEqual([1, 5001]);
  });

  it("renumberDate closes the gap a deleted record leaves", async () => {
    rows = rows.filter((r) => r.id !== "b");
    expect(await renumberDate(table, tx, dateOnly(DAY))).toEqual(["c"]);
    expect(onDate()).toBe("a:1/5001, c:2/5003");
  });
});

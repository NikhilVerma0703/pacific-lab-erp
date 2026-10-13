import "server-only";
import { syncInwardRecords } from "@/modules/inward-outward/record-store";
import { syncLabRecords } from "@/modules/samples/record-store";

let synced: Promise<void> | null = null;

/**
 * Make sure the Lab Sample and Sample Inward / Outward databases hold an
 * up-to-date copy of every record — once per server process (records saved
 * before these databases existed are copied on the first visit).
 */
export function ensureRecordStores(): Promise<void> {
  synced ??= (async () => {
    const lab = await syncLabRecords();
    const inward = await syncInwardRecords();
    if (lab || inward) console.log(`record stores: ${lab} lab sample(s), ${inward} inward / outward entr${inward === 1 ? "y" : "ies"} copied`);
  })().catch((e) => {
    synced = null;
    console.error("record stores", e);
  });
  return synced;
}

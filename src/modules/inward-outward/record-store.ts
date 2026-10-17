import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { inwardInclude } from "./include";
import { inwardDesignOf } from "./design-text";
import { toInwardDetail } from "./queries";

/**
 * Sample Inward / Outward Database — `InwardOutwardRecord`: one complete,
 * self-contained copy of every saved entry (the whole `InwardDetail`: Sample
 * Details, design and design types with their fields, all L, a, b readings,
 * files, remarks, plus what the earlier form recorded), with the main fields
 * as columns. It is the reference for existing physical samples (the Lab
 * Sample form's Design Name suggestions read it). Written inside the save
 * transaction, removed with the entry.
 */
// 2: Plain Body / design types of the earlier form's entries read body by body.
export const INWARD_RECORD_VERSION = 2;

export async function writeInwardRecord(tx: Tx, entryId: string) {
  const e = await tx.inwardOutwardEntry.findUnique({ where: { id: entryId }, include: inwardInclude });
  if (!e) {
    await tx.inwardOutwardRecord.deleteMany({ where: { entryId } });
    return;
  }
  const d = toInwardDetail(e);
  const design = inwardDesignOf(d);
  const row = {
    serialNo: d.serialNo,
    slabNumber: d.slabNumber,
    entryDate: e.entryDate,
    companyId: d.company?.id ?? null,
    company: d.company?.label ?? null,
    designNameId: d.sampleDesignNameRef?.id ?? null,
    designName: d.sampleDesignName,
    plainBody: design.plainBody,
    designTypes: design.types,
    numberOfBodies: d.numberOfBodies,
    formVersion: INWARD_RECORD_VERSION,
    data: JSON.parse(JSON.stringify(d)) as Prisma.InputJsonValue,
  };
  await tx.inwardOutwardRecord.upsert({ where: { entryId }, create: { entryId, ...row }, update: row });
}

/** Entries whose copy is missing or older than the entry (or than this version). */
export async function staleInwardRecordIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id FROM "InwardOutwardEntry" e
    LEFT JOIN "InwardOutwardRecord" r ON r."entryId" = e.id
    WHERE r."entryId" IS NULL OR r."formVersion" < ${INWARD_RECORD_VERSION} OR r."updatedAt" < e."updatedAt"`);
  return rows.map((r) => r.id);
}

/** Bring every copy up to date (first start after an update, `npm run db:seed`). */
export async function syncInwardRecords(): Promise<number> {
  const ids = await staleInwardRecordIds();
  for (const id of ids) await prisma.$transaction((tx) => writeInwardRecord(tx, id));
  return ids.length;
}

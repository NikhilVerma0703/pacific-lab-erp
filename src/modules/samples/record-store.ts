import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { sampleInclude } from "./include";
import { toDetail } from "./queries";

/**
 * Lab Sample Database — `LabSampleRecord`: one complete, self-contained copy
 * of every saved lab sample (the whole `SampleDetail`: Basic Information,
 * design and design types with their fields, Material Details of every body,
 * Roy / Chessboard bodies, all L, a, b readings, files, remarks, plus what an
 * earlier form recorded), with the main fields as columns for querying.
 * Written inside the save transaction, removed with the sample.
 */
export const LAB_RECORD_VERSION = 1;

export async function writeLabRecord(tx: Tx, sampleId: string) {
  const s = await tx.labSample.findUnique({ where: { id: sampleId }, include: sampleInclude });
  if (!s) {
    await tx.labSampleRecord.deleteMany({ where: { sampleId } });
    return;
  }
  const d = toDetail(s);
  const row = {
    serialNo: d.serialNo,
    slabNumber: d.slabNumber,
    sampleDate: s.sampleDate,
    designNameId: d.designNameRef?.id ?? null,
    designName: d.designName,
    plainBody: d.plainBody,
    designTypes: d.plainBody === false ? d.designTypes.map((t) => t.type) : [],
    numberOfBodies: d.numberOfBodies,
    formVersion: LAB_RECORD_VERSION,
    data: JSON.parse(JSON.stringify(d)) as Prisma.InputJsonValue,
  };
  await tx.labSampleRecord.upsert({ where: { sampleId }, create: { sampleId, ...row }, update: row });
}

/** Lab samples whose copy is missing or older than the sample (or than this version). */
export async function staleLabRecordIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT s.id FROM "LabSample" s
    LEFT JOIN "LabSampleRecord" r ON r."sampleId" = s.id
    WHERE r."sampleId" IS NULL OR r."formVersion" < ${LAB_RECORD_VERSION} OR r."updatedAt" < s."updatedAt"`);
  return rows.map((r) => r.id);
}

/** Bring every copy up to date (first start after an update, `npm run db:seed`). */
export async function syncLabRecords(): Promise<number> {
  const ids = await staleLabRecordIds();
  for (const id of ids) await prisma.$transaction((tx) => writeLabRecord(tx, id));
  return ids.length;
}

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import { MASTER, VALUE_CODE, type MasterCode } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import type { MasterRef } from "@/modules/master-data/types";
import { formulationInclude, writeFormulation } from "@/modules/formulation/service";
import { codesOf, todayInPlant } from "@/modules/samples/service";
import type { InwardFormData } from "./schema";

export class InwardSaveError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const LOCK_KEY = 4_471_002; // "inward/outward numbering"

type Db = Tx | typeof prisma;

export async function nextInwardSerial(db: Db): Promise<number> {
  const agg = await db.inwardOutwardEntry.aggregate({ _max: { serialNo: true } });
  return (agg._max.serialNo ?? 0) + 1;
}

/**
 * Create or update an Inward / Outward entry in one transaction.
 * Linking it to an Inspired lab sample marks that sample's physical sample as
 * present, which moves it out of Rectification.
 */
export async function saveInward(args: {
  id?: string;
  data: InwardFormData;
  user: CurrentUser;
  autoSerial?: boolean;
}): Promise<{ id: string; serialNo: number }> {
  const { id, data, user, autoSerial } = args;
  const canOverride = can(user, "inward.overrideNumbers");
  const canAddMaster = can(user, "master.addFromForm");

  return prisma
    .$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;

        const existing = id ? await tx.inwardOutwardEntry.findUnique({ where: { id } }) : null;
        if (id && !existing) throw new InwardSaveError("This entry no longer exists — it may have been deleted.");

        const resolve = async (code: MasterCode, ref: MasterRef | null | undefined) => {
          if (ref && !ref.id && ref.label.trim() && !canAddMaster) {
            throw new InwardSaveError(`You cannot add new list values (“${ref.label}”). Pick one from the list.`);
          }
          return resolveMasterRef(tx, code, ref, user.id);
        };

        // ── serial number ────────────────────────────────────────────────────
        let serialNo: number;
        if (existing) serialNo = canOverride && data.serialNo !== null ? data.serialNo : existing.serialNo;
        else serialNo = canOverride && !autoSerial && data.serialNo !== null ? data.serialNo : await nextInwardSerial(tx);
        const clash = await tx.inwardOutwardEntry.findFirst({
          where: { serialNo, ...(existing ? { NOT: { id: existing.id } } : {}) },
          select: { id: true },
        });
        if (clash) throw new InwardSaveError("Duplicate serial number.", { serialNo: `Serial No. ${serialNo} is already used.` });

        // ── link to the lab sample ───────────────────────────────────────────
        const labSampleId = existing ? (data.labSampleId ?? existing.labSampleId) : data.labSampleId;
        if (labSampleId && labSampleId !== existing?.labSampleId) {
          const sample = await tx.labSample.findUnique({
            where: { id: labSampleId },
            select: { serialNo: true, sampleType: { select: { code: true } }, inwardEntry: { select: { serialNo: true } } },
          });
          if (!sample) throw new InwardSaveError("The linked lab sample no longer exists.");
          if (sample.sampleType?.code !== VALUE_CODE.INSPIRED_SAMPLE) {
            throw new InwardSaveError(`Lab sample S.No. ${sample.serialNo} is not an Inspired sample.`);
          }
          if (sample.inwardEntry) {
            throw new InwardSaveError(
              `Lab sample S.No. ${sample.serialNo} is already recorded as Inward/Outward Serial No. ${sample.inwardEntry.serialNo}.`,
            );
          }
        }

        const base = {
          serialNo,
          entryDate: new Date(`${data.entryDate ?? (existing ? existing.entryDate.toISOString().slice(0, 10) : todayInPlant())}T00:00:00Z`),
          labSampleId: labSampleId ?? null,
          companyId: await resolve(MASTER.COMPANY, data.company),
          sampleDesignName: data.sampleDesignName,
          numberOfBodies: data.numberOfBodies,
          designCategory: data.designCategory,
          recreationAttempts: data.recreationAttempts,
          updatedById: user.id,
        };

        const entry = existing
          ? await tx.inwardOutwardEntry.update({ where: { id: existing.id }, data: base })
          : await tx.inwardOutwardEntry.create({ data: { ...base, createdById: user.id } });

        if (existing) {
          await tx.formulation.deleteMany({ where: { inwardEntryId: entry.id } });
          await tx.inwardDesignPattern.deleteMany({ where: { entryId: entry.id } });
          await tx.inwardMeasurement.deleteMany({ where: { entryId: entry.id } });
        }

        if (data.designCategory === "NON_PLAIN_BODY") {
          const patternIds: string[] = [];
          for (const ref of data.designPatterns) {
            const pid = await resolve(MASTER.DESIGN_PATTERN, ref);
            if (pid && !patternIds.includes(pid)) patternIds.push(pid);
          }
          if (patternIds.length) {
            await tx.inwardDesignPattern.createMany({
              data: patternIds.map((patternId, i) => ({ entryId: entry.id, patternId, sortOrder: i })),
            });
          }
          if ((await codesOf(tx, patternIds)).has(VALUE_CODE.ROY_BODY)) {
            await writeFormulation(tx, { inwardEntryId: entry.id }, "DESIGN_ROY_BODY", data.designRoyBody, resolve);
          }
        }

        const n = data.numberOfBodies ?? 0;
        const rows = data.measurements
          .slice(0, n)
          .map((r, i) => ({ entryId: entry.id, bodyIndex: i + 1, l: r.l, a: r.a, b: r.b }))
          .filter((r) => r.l !== null || r.a !== null || r.b !== null);
        if (rows.length) await tx.inwardMeasurement.createMany({ data: rows });

        // The physical sample is in hand → no longer a Rectification item.
        if (entry.labSampleId) {
          await tx.labSample.update({ where: { id: entry.labSampleId }, data: { physicalSamplePresent: true } });
        }

        await audit(tx, {
          entityType: "InwardOutwardEntry",
          entityId: entry.id,
          action: existing ? "UPDATE" : "CREATE",
          summary: `Serial No. ${serialNo}`,
          snapshot: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          userId: user.id,
        });

        return { id: entry.id, serialNo };
      },
      { timeout: 20_000, maxWait: 10_000 },
    )
    .catch((e) => {
      if (e instanceof MasterValueError) throw new InwardSaveError(e.message);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("labSample")) throw new InwardSaveError("That lab sample was just recorded by someone else.");
        throw new InwardSaveError("That serial number was just taken. Please save again.", { serialNo: "Already used." });
      }
      throw e;
    });
}

export const inwardInclude = {
  company: { select: { id: true, label: true, code: true, isActive: true } },
  labSample: { select: { id: true, serialNo: true, slabNumber: true, sampleDate: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  designPatterns: {
    include: { pattern: { select: { id: true, label: true, code: true, isActive: true } } },
    orderBy: { sortOrder: "asc" },
  },
  measurements: { orderBy: { bodyIndex: "asc" } },
  formulations: { include: formulationInclude },
} satisfies Prisma.InwardOutwardEntryInclude;

/** Permanent delete, with the full record kept in the audit log. */
export async function deleteInward(id: string, user: CurrentUser): Promise<{ serialNo: number }> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.inwardOutwardEntry.findUnique({ where: { id }, include: inwardInclude });
    if (!snapshot) throw new InwardSaveError("This entry was already deleted.");
    await audit(tx, {
      entityType: "InwardOutwardEntry",
      entityId: id,
      action: "DELETE",
      summary: `Deleted Serial No. ${snapshot.serialNo}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    await tx.inwardOutwardEntry.delete({ where: { id } });
    return { serialNo: snapshot.serialNo };
  });
}

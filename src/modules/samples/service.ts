import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import { MASTER, VALUE_CODE, type MasterCode } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import type { MasterRef } from "@/modules/master-data/types";
import { lockNumbering, nextSerialNo, nextSlabNumber } from "./numbering";
import { formulationInclude, writeFormulation, writeRoyBody } from "@/modules/formulation/service";
import type { SampleFormData } from "./schema";

export class SampleSaveError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Today's date (YYYY-MM-DD) in the plant's time zone, not the server's. */
export const todayInPlant = () => plantToday();

const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

export async function codesOf(tx: Tx, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await tx.masterValue.findMany({ where: { id: { in: ids } }, select: { code: true } });
  return new Set(rows.map((r) => r.code).filter((c): c is string => !!c));
}

/**
 * Create or update a sample, with everything under it, in one transaction.
 * On update the child rows are replaced wholesale — simpler and safer than
 * diffing, and the previous version is kept in the audit log.
 */
export async function saveSample(args: {
  id?: string;
  data: SampleFormData;
  status: "DRAFT" | "SUBMITTED";
  user: CurrentUser;
  /** Create only: allocate S.No. / Slab even if the form carried a value (an untouched suggestion). */
  autoSerial?: boolean;
  autoSlab?: boolean;
}): Promise<{
  id: string;
  serialNo: number;
  slabNumber: number | null;
  removedKeys: string[];
  /** Inspired + physical sample present + not yet recorded in Inward / Outward. */
  needsInward: boolean;
}> {
  const { id, data, status, user, autoSerial, autoSlab } = args;
  const canOverride = can(user, "sample.overrideNumbers");
  const canDate = can(user, "sample.changeDate");
  const canAddMaster = can(user, "master.addFromForm");
  const canRemoveFiles = can(user, "attachment.remove");

  return prisma.$transaction(
    async (tx) => {
      await lockNumbering(tx);

      const existing = id
        ? await tx.labSample.findUnique({
            where: { id },
            include: { attachments: { select: { id: true, storageKey: true } } },
          })
        : null;
      if (id && !existing) throw new SampleSaveError("This sample no longer exists — it may have been deleted.");

      const resolve = async (code: MasterCode, ref: MasterRef | null | undefined) => {
        if (ref && !ref.id && ref.label.trim() && !canAddMaster) {
          throw new SampleSaveError(`You cannot add new list values (“${ref.label}”). Pick one from the list.`);
        }
        return resolveMasterRef(tx, code, ref, user.id);
      };

      // ── numbers ────────────────────────────────────────────────────────────
      let serialNo: number;
      let slabNumber: number | null;
      if (existing) {
        serialNo = canOverride && data.serialNo !== null ? data.serialNo : existing.serialNo;
        slabNumber = canOverride ? data.slabNumber : existing.slabNumber;
      } else {
        serialNo = canOverride && !autoSerial && data.serialNo !== null ? data.serialNo : await nextSerialNo(tx);
        slabNumber = canOverride && !autoSlab ? data.slabNumber : await nextSlabNumber(tx);
      }
      const fieldErrors: Record<string, string> = {};
      const serialClash = await tx.labSample.findFirst({
        where: { serialNo, ...(existing ? { NOT: { id: existing.id } } : {}) },
        select: { id: true },
      });
      if (serialClash) fieldErrors.serialNo = `S.No. ${serialNo} is already used by another sample.`;
      if (slabNumber !== null) {
        const slabClash = await tx.labSample.findFirst({
          where: { slabNumber, ...(existing ? { NOT: { id: existing.id } } : {}) },
          select: { serialNo: true },
        });
        if (slabClash) fieldErrors.slabNumber = `Slab ${slabNumber} is already used by S.No. ${slabClash.serialNo}.`;
      }
      if (Object.keys(fieldErrors).length) throw new SampleSaveError("Duplicate number — see the highlighted fields.", fieldErrors);

      // ── date ───────────────────────────────────────────────────────────────
      const sampleDate = canDate
        ? dateOnly(data.sampleDate ?? todayInPlant())
        : existing
          ? existing.sampleDate
          : dateOnly(todayInPlant());

      // ── sample type decides which parts of the form apply ─────────────────
      const sampleTypeId = await resolve(MASTER.SAMPLE_TYPE, data.sampleType);
      const typeCodes = await codesOf(tx, sampleTypeId ? [sampleTypeId] : []);
      const isCreative = typeCodes.has(VALUE_CODE.CREATIVE_SAMPLE);
      const isInspired = typeCodes.has(VALUE_CODE.INSPIRED_SAMPLE);

      const base = {
        serialNo,
        slabNumber,
        sampleDate,
        status,
        sampleTypeId,
        designName: data.designName,
        numberOfBodies: isCreative ? data.numberOfBodies : null,
        // Design and Vein now live on each body (SampleBody). The sample-level
        // columns only remain for samples saved before bodies existed.
        designCategory: null,
        mixerTypeId: null,
        hasVein: null,
        veinNotes: null,
        remarks: data.remarks,
        physicalSamplePresent: isInspired ? data.physicalSamplePresent : null,
        updatedById: user.id,
      };

      const sample = existing
        ? await tx.labSample.update({ where: { id: existing.id }, data: base })
        : await tx.labSample.create({ data: { ...base, createdById: user.id } });

      if (existing) {
        await tx.formulation.deleteMany({ where: { sampleId: sample.id } });
        await tx.sampleDesignPattern.deleteMany({ where: { sampleId: sample.id } });
        await tx.sampleVeinMethod.deleteMany({ where: { sampleId: sample.id } });
        await tx.labMeasurement.deleteMany({ where: { sampleId: sample.id } });
        await tx.sampleBody.deleteMany({ where: { sampleId: sample.id } });
      }

      if (isCreative) {
        // Body 1 … n — each body on its own: Material Choices, Design, Vein, L/a/b.
        const n = data.numberOfBodies ?? 0;
        const labRows: Prisma.LabMeasurementCreateManyInput[] = [];
        for (const [i, body] of data.bodies.slice(0, n).entries()) {
          const bodyIndex = i + 1;
          const veinApplies = body.hasVein !== false;
          const row = await tx.sampleBody.create({
            data: {
              sampleId: sample.id,
              bodyIndex,
              designCategory: body.designCategory,
              mixerTypeId: await resolve(MASTER.MIXER_TYPE, body.mixerType),
              hasVein: body.hasVein,
              veinNotes: veinApplies ? body.veinNotes : null,
            },
          });

          await writeFormulation(tx, { sampleId: sample.id }, "MAIN_BODY", body.main, resolve, bodyIndex);

          // Design
          if (body.designCategory === "NON_PLAIN_BODY") {
            const patternIds: string[] = [];
            for (const ref of body.designPatterns) {
              const pid = await resolve(MASTER.DESIGN_PATTERN, ref);
              if (pid && !patternIds.includes(pid)) patternIds.push(pid);
            }
            if (patternIds.length) {
              await tx.sampleBodyDesignPattern.createMany({
                data: patternIds.map((patternId, k) => ({ bodyId: row.id, patternId, sortOrder: k })),
              });
            }
            if ((await codesOf(tx, patternIds)).has(VALUE_CODE.ROY_BODY)) {
              await writeRoyBody(tx, { sampleId: sample.id }, "DESIGN_ROY_BODY", body.designRoyBody, resolve, bodyIndex);
            }
          }

          // Vein
          if (veinApplies) {
            const methodIds: string[] = [];
            for (const ref of body.veinMethods) {
              const mid = await resolve(MASTER.VEIN_METHOD, ref);
              if (mid && !methodIds.includes(mid)) methodIds.push(mid);
            }
            if (methodIds.length) {
              await tx.sampleBodyVeinMethod.createMany({
                data: methodIds.map((methodId, k) => ({ bodyId: row.id, methodId, sortOrder: k })),
              });
            }
            if ((await codesOf(tx, methodIds)).has(VALUE_CODE.ROY_BODY)) {
              await writeFormulation(tx, { sampleId: sample.id }, "VEIN_ROY_BODY", body.veinRoyBody, resolve, bodyIndex);
            }
          }

          // This body's L / a / b — only where something was measured.
          for (const [stage, r] of [
            ["POST_PRESS", body.postPress],
            ["POST_POLISH", body.postPolish],
          ] as const) {
            if (r.l === null && r.a === null && r.b === null) continue;
            labRows.push({ sampleId: sample.id, stage, bodyIndex, l: r.l, a: r.a, b: r.b });
          }
        }
        if (labRows.length) await tx.labMeasurement.createMany({ data: labRows });
      }

      // ── attachments ────────────────────────────────────────────────────────
      const wanted = new Set(data.attachmentIds);
      const current = existing?.attachments ?? [];
      const toRemove = current.filter((a) => !wanted.has(a.id));
      if (toRemove.length && !canRemoveFiles) {
        throw new SampleSaveError("You do not have permission to remove attached files.");
      }
      const newIds = [...wanted].filter((aid) => !current.some((a) => a.id === aid));
      if (newIds.length) {
        const ok = await tx.sampleAttachment.updateMany({
          where: { id: { in: newIds }, sampleId: null, uploadedById: user.id },
          data: { sampleId: sample.id },
        });
        if (ok.count !== newIds.length) {
          throw new SampleSaveError("One of the uploaded files has expired. Please upload it again.");
        }
      }
      if (toRemove.length) {
        await tx.sampleAttachment.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });
      }

      await audit(tx, {
        entityType: "LabSample",
        entityId: sample.id,
        action: existing ? "UPDATE" : "CREATE",
        summary: `S.No. ${serialNo}${slabNumber ? ` / Slab ${slabNumber}` : ""} (${status})`,
        snapshot: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
        userId: user.id,
      });

      const needsInward =
        isInspired &&
        data.physicalSamplePresent === true &&
        !(await tx.inwardOutwardEntry.findUnique({ where: { labSampleId: sample.id }, select: { id: true } }));

      return { id: sample.id, serialNo, slabNumber, removedKeys: toRemove.map((a) => a.storageKey), needsInward };
    },
    { timeout: 20_000, maxWait: 10_000 },
  ).catch((e) => {
    if (e instanceof MasterValueError) throw new SampleSaveError(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: unknown })?.target ?? "");
      if (target.includes("slab")) throw new SampleSaveError("That slab number was just taken. Please save again.", { slabNumber: "Already used." });
      throw new SampleSaveError("That S.No. was just taken. Please save again.", { serialNo: "Already used." });
    }
    throw e;
  });
}

/**
 * Permanently delete a sample (as the brief requires), after writing its full
 * record to the audit log so the history is not lost.
 */
export async function deleteSample(id: string, user: CurrentUser): Promise<{ serialNo: number; removedKeys: string[] }> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.labSample.findUnique({ where: { id }, include: sampleInclude });
    if (!snapshot) throw new SampleSaveError("This sample was already deleted.");
    await audit(tx, {
      entityType: "LabSample",
      entityId: id,
      action: "DELETE",
      summary: `Deleted S.No. ${snapshot.serialNo}${snapshot.slabNumber ? ` / Slab ${snapshot.slabNumber}` : ""}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    await tx.labSample.delete({ where: { id } }); // children cascade
    return { serialNo: snapshot.serialNo, removedKeys: snapshot.attachments.map((a) => a.storageKey) };
  });
}

export const sampleInclude = {
  sampleType: { select: { id: true, label: true, code: true, isActive: true } },
  mixerType: { select: { id: true, label: true, code: true, isActive: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  formulations: { include: formulationInclude },
  designPatterns: {
    include: { pattern: { select: { id: true, label: true, code: true, isActive: true } } },
    orderBy: { sortOrder: "asc" },
  },
  veinMethods: {
    include: { method: { select: { id: true, label: true, code: true, isActive: true } } },
    orderBy: { sortOrder: "asc" },
  },
  measurements: { orderBy: [{ stage: "asc" }, { bodyIndex: "asc" }] },
  attachments: { orderBy: { createdAt: "asc" } },
  inwardEntry: { select: { id: true, serialNo: true } },
  bodies: {
    include: {
      mixerType: { select: { id: true, label: true, code: true, isActive: true } },
      designPatterns: {
        include: { pattern: { select: { id: true, label: true, code: true, isActive: true } } },
        orderBy: { sortOrder: "asc" },
      },
      veinMethods: {
        include: { method: { select: { id: true, label: true, code: true, isActive: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { bodyIndex: "asc" },
  },
} satisfies Prisma.LabSampleInclude;

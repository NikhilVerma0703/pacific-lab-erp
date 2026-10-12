import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import type { CurrentUser } from "@/lib/session";
import { readingIsEmpty } from "@/modules/forms/fields";
import { MASTER } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import { lockProductionNumbering, nextProductionSerial, nextProductionSlab } from "./numbering";
import type { ProductionFormData } from "./schema";

export class ProductionSaveError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * Create or update a production sample in one transaction:
 * Basic Information, the L, a, b of Body 1 … N (Post Press / Post Polish),
 * Sample Output files and Remarks. On update the readings are replaced; the
 * previous version is kept in the audit log.
 *
 * Entries saved with the earlier form may also carry a Design per body (and a
 * Roy Body). The rebuilt form does not show it; it is left as it was for
 * Body 1 … N (Downloads still export it) and removed for bodies above N.
 */
export async function saveProductionSample(args: {
  id?: string;
  data: ProductionFormData;
  user: CurrentUser;
  /** Create only: allocate S.No. / Slab even if the form carried a value (an untouched suggestion). */
  autoSerial?: boolean;
  autoSlab?: boolean;
}): Promise<{ id: string; serialNo: number; slabNumber: number | null; removedKeys: string[] }> {
  const { id, data, user, autoSerial, autoSlab } = args;
  const canOverride = can(user, "production.overrideNumbers");
  const canDate = can(user, "production.changeDate");
  const canAddMaster = can(user, "master.addFromForm");
  const canRemoveFiles = can(user, "attachment.remove");

  return prisma
    .$transaction(
      async (tx) => {
        await lockProductionNumbering(tx);

        const existing = id
          ? await tx.productionSample.findUnique({
              where: { id },
              include: { attachments: { select: { id: true, storageKey: true } } },
            })
          : null;
        if (id && !existing) throw new ProductionSaveError("This entry no longer exists — it may have been deleted.");

        // ── numbers ──────────────────────────────────────────────────────────
        let serialNo: number;
        let slabNumber: number | null;
        if (existing) {
          serialNo = canOverride && data.serialNo !== null ? data.serialNo : existing.serialNo;
          slabNumber = canOverride ? data.slabNumber : existing.slabNumber;
        } else {
          serialNo = canOverride && !autoSerial && data.serialNo !== null ? data.serialNo : await nextProductionSerial(tx);
          slabNumber = canOverride && !autoSlab ? data.slabNumber : await nextProductionSlab(tx);
        }
        const fieldErrors: Record<string, string> = {};
        const notMe = existing ? { NOT: { id: existing.id } } : {};
        if (await tx.productionSample.findFirst({ where: { serialNo, ...notMe }, select: { id: true } })) {
          fieldErrors.serialNo = `S.No. ${serialNo} is already used by another production sample.`;
        }
        if (slabNumber !== null) {
          const clash = await tx.productionSample.findFirst({ where: { slabNumber, ...notMe }, select: { serialNo: true } });
          if (clash) fieldErrors.slabNumber = `Slab ${slabNumber} is already used by S.No. ${clash.serialNo}.`;
        }
        if (Object.keys(fieldErrors).length) {
          throw new ProductionSaveError("Duplicate number — see the highlighted fields.", fieldErrors);
        }

        // ── date ─────────────────────────────────────────────────────────────
        const sampleDate = canDate
          ? dateOnly(data.sampleDate ?? plantToday())
          : existing
            ? existing.sampleDate
            : dateOnly(plantToday());

        // ── Design Name (Design Names list) ──────────────────────────────────
        if (data.designName && !data.designName.id && data.designName.label.trim() && !canAddMaster) {
          throw new ProductionSaveError(`You cannot add new list values (“${data.designName.label}”). Pick one from the list.`);
        }
        const designNameId = await resolveMasterRef(tx, MASTER.DESIGN_NAME, data.designName, user.id);

        const n = data.numberOfBodies ?? 0;
        const base = {
          serialNo,
          slabNumber,
          sampleDate,
          designNameId,
          // A name typed before the Design Names list existed is now the list value.
          legacyDesignName: null,
          numberOfBodies: data.numberOfBodies,
          remarks: data.remarks,
          updatedById: user.id,
        };

        const sample = existing
          ? await tx.productionSample.update({ where: { id: existing.id }, data: base })
          : await tx.productionSample.create({ data: { ...base, createdById: user.id } });

        if (existing) {
          await tx.productionMeasurement.deleteMany({ where: { productionSampleId: sample.id, part: "MAIN" } });
          // Bodies above N go, with anything the earlier form recorded for them.
          await tx.productionBody.deleteMany({ where: { productionSampleId: sample.id, bodyIndex: { gt: n } } });
          await tx.productionMeasurement.deleteMany({ where: { productionSampleId: sample.id, part: "ROY_BODY", ownerBody: { gt: n } } });
        }

        // ── L, a, b: Body 1 … N, Post Press / Post Polish ────────────────────
        const rows: Prisma.ProductionMeasurementCreateManyInput[] = [];
        for (const [k, body] of data.bodies.slice(0, n).entries()) {
          for (const [stage, r] of [
            ["POST_PRESS", body.postPress],
            ["POST_POLISH", body.postPolish],
          ] as const) {
            if (readingIsEmpty(r)) continue;
            rows.push({ productionSampleId: sample.id, part: "MAIN", ownerBody: 0, stage, bodyIndex: k + 1, l: r.l, a: r.a, b: r.b });
          }
        }
        if (rows.length) await tx.productionMeasurement.createMany({ data: rows });

        // ── Sample Output (files) ────────────────────────────────────────────
        const wanted = new Set(data.attachmentIds);
        const current = existing?.attachments ?? [];
        const toRemove = current.filter((a) => !wanted.has(a.id));
        if (toRemove.length && !canRemoveFiles) {
          throw new ProductionSaveError("You do not have permission to remove attached files.");
        }
        const newIds = [...wanted].filter((aid) => !current.some((a) => a.id === aid));
        if (newIds.length) {
          const ok = await tx.sampleAttachment.updateMany({
            where: { id: { in: newIds }, sampleId: null, productionSampleId: null, uploadedById: user.id },
            data: { productionSampleId: sample.id },
          });
          if (ok.count !== newIds.length) {
            throw new ProductionSaveError("One of the uploaded files has expired. Please upload it again.");
          }
        }
        if (toRemove.length) {
          await tx.sampleAttachment.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });
        }

        await audit(tx, {
          entityType: "ProductionSample",
          entityId: sample.id,
          action: existing ? "UPDATE" : "CREATE",
          summary: `Production S.No. ${serialNo}${slabNumber ? ` / Slab ${slabNumber}` : ""}`,
          snapshot: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          userId: user.id,
        });

        return { id: sample.id, serialNo, slabNumber, removedKeys: toRemove.map((a) => a.storageKey) };
      },
      { timeout: 20_000, maxWait: 10_000 },
    )
    .catch((e) => {
      if (e instanceof MasterValueError) throw new ProductionSaveError(e.message);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("slab")) throw new ProductionSaveError("That slab number was just taken. Please save again.", { slabNumber: "Already used." });
        throw new ProductionSaveError("That S.No. was just taken. Please save again.", { serialNo: "Already used." });
      }
      throw e;
    });
}

/** Permanently delete an entry, after writing its full record to the audit log. */
export async function deleteProductionSample(id: string, user: CurrentUser): Promise<{ serialNo: number; removedKeys: string[] }> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.productionSample.findUnique({ where: { id }, include: productionInclude });
    if (!snapshot) throw new ProductionSaveError("This entry was already deleted.");
    await audit(tx, {
      entityType: "ProductionSample",
      entityId: id,
      action: "DELETE",
      summary: `Deleted production S.No. ${snapshot.serialNo}${snapshot.slabNumber ? ` / Slab ${snapshot.slabNumber}` : ""}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    await tx.productionSample.delete({ where: { id } }); // patterns, readings and files cascade
    return { serialNo: snapshot.serialNo, removedKeys: snapshot.attachments.map((a) => a.storageKey) };
  });
}

export const productionInclude = {
  designNameValue: { select: { id: true, label: true, code: true, isActive: true } },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  designPatterns: {
    include: { pattern: { select: { id: true, label: true, code: true, isActive: true } } },
    orderBy: { sortOrder: "asc" },
  },
  measurements: { orderBy: [{ part: "asc" }, { ownerBody: "asc" }, { stage: "asc" }, { bodyIndex: "asc" }] },
  attachments: { orderBy: { createdAt: "asc" } },
  bodies: {
    include: {
      designPatterns: {
        include: { pattern: { select: { id: true, label: true, code: true, isActive: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { bodyIndex: "asc" },
  },
} satisfies Prisma.ProductionSampleInclude;

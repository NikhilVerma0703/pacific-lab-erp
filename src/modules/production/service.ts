import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import type { CurrentUser } from "@/lib/session";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import type { MasterRef } from "@/modules/master-data/types";
import { codesOf } from "@/modules/samples/service";
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

type LabRow = ProductionFormData["bodies"][number]["designRoyBody"]["postPress"][number];

/** L/a/b rows worth storing: one per body per stage, only where something was measured. */
function measurementRows(
  productionSampleId: string,
  part: "MAIN" | "ROY_BODY",
  n: number,
  postPress: LabRow[],
  postPolish: LabRow[],
): Prisma.ProductionMeasurementCreateManyInput[] {
  const rows: Prisma.ProductionMeasurementCreateManyInput[] = [];
  for (const [stage, list] of [
    ["POST_PRESS", postPress],
    ["POST_POLISH", postPolish],
  ] as const) {
    list.slice(0, n).forEach((r, i) => {
      if (r.l === null && r.a === null && r.b === null) return;
      rows.push({ productionSampleId, part, stage, bodyIndex: i + 1, l: r.l, a: r.a, b: r.b });
    });
  }
  return rows;
}

/**
 * Create or update a production sample, with everything under it, in one
 * transaction. On update the child rows are replaced wholesale; the previous
 * version is kept in the audit log.
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

        const resolve = async (ref: MasterRef | null | undefined) => {
          if (ref && !ref.id && ref.label.trim() && !canAddMaster) {
            throw new ProductionSaveError(`You cannot add new list values (“${ref.label}”). Pick one from the list.`);
          }
          return resolveMasterRef(tx, MASTER.DESIGN_PATTERN, ref, user.id);
        };

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
          fieldErrors.serialNo = `S. No. ${serialNo} is already used by another production sample.`;
        }
        if (slabNumber !== null) {
          const clash = await tx.productionSample.findFirst({ where: { slabNumber, ...notMe }, select: { serialNo: true } });
          if (clash) fieldErrors.slabNumber = `Slab ${slabNumber} is already used by S. No. ${clash.serialNo}.`;
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

        const base = {
          serialNo,
          slabNumber,
          sampleDate,
          designName: data.designName,
          numberOfBodies: data.numberOfBodies,
          // Design now lives on each body (ProductionBody); the entry-level
          // columns only remain for entries saved before bodies existed.
          designCategory: null,
          royNumberOfBodies: null,
          remarks: data.remarks,
          updatedById: user.id,
        };

        const sample = existing
          ? await tx.productionSample.update({ where: { id: existing.id }, data: base })
          : await tx.productionSample.create({ data: { ...base, createdById: user.id } });

        if (existing) {
          await tx.productionDesignPattern.deleteMany({ where: { productionSampleId: sample.id } });
          await tx.productionMeasurement.deleteMany({ where: { productionSampleId: sample.id } });
          await tx.productionBody.deleteMany({ where: { productionSampleId: sample.id } });
        }

        // Body 1 … n — each body's Design (+ Roy Body: n and L/a/b) and its own L/a/b.
        const n = data.numberOfBodies ?? 0;
        const rows: Prisma.ProductionMeasurementCreateManyInput[] = [];
        for (const [k, body] of data.bodies.slice(0, n).entries()) {
          const bodyIndex = k + 1;
          const patternIds: string[] = [];
          if (body.designCategory === "NON_PLAIN_BODY") {
            for (const ref of body.designPatterns) {
              const pid = await resolve(ref);
              if (pid && !patternIds.includes(pid)) patternIds.push(pid);
            }
          }
          const hasRoy = (await codesOf(tx, patternIds)).has(VALUE_CODE.ROY_BODY);
          const row = await tx.productionBody.create({
            data: {
              productionSampleId: sample.id,
              bodyIndex,
              designCategory: body.designCategory,
              royNumberOfBodies: hasRoy ? body.designRoyBody.numberOfBodies : null,
            },
          });
          if (patternIds.length) {
            await tx.productionBodyDesignPattern.createMany({
              data: patternIds.map((patternId, i) => ({ bodyId: row.id, patternId, sortOrder: i })),
            });
          }
          for (const [stage, r] of [
            ["POST_PRESS", body.postPress],
            ["POST_POLISH", body.postPolish],
          ] as const) {
            if (r.l === null && r.a === null && r.b === null) continue;
            rows.push({ productionSampleId: sample.id, part: "MAIN", ownerBody: 0, stage, bodyIndex, l: r.l, a: r.a, b: r.b });
          }
          if (hasRoy) {
            const roy = body.designRoyBody;
            rows.push(
              ...measurementRows(sample.id, "ROY_BODY", roy.numberOfBodies ?? 0, roy.postPress, roy.postPolish).map((m) => ({ ...m, ownerBody: bodyIndex })),
            );
          }
        }
        if (rows.length) await tx.productionMeasurement.createMany({ data: rows });

        // ── attachments (Sample Output) ──────────────────────────────────────
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
          summary: `Production S. No. ${serialNo}${slabNumber ? ` / Slab ${slabNumber}` : ""}`,
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
        throw new ProductionSaveError("That S. No. was just taken. Please save again.", { serialNo: "Already used." });
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
      summary: `Deleted production S. No. ${snapshot.serialNo}${snapshot.slabNumber ? ` / Slab ${snapshot.slabNumber}` : ""}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    await tx.productionSample.delete({ where: { id } }); // patterns, readings and files cascade
    return { serialNo: snapshot.serialNo, removedKeys: snapshot.attachments.map((a) => a.storageKey) };
  });
}

export const productionInclude = {
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

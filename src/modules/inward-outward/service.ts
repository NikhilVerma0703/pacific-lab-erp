import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import type { CurrentUser } from "@/lib/session";
import { readingIsEmpty, type LabReadingData } from "@/modules/forms/fields";
import { MASTER, type MasterCode } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import type { MasterRef } from "@/modules/master-data/types";
import { allocateNumbers, dateOnly } from "@/modules/forms/date-numbering";
import { otherPatternIds, patternFor } from "@/modules/forms/design-server";
import type { DesignTypeKey } from "@/modules/forms/design-types";
import { inwardInclude } from "./include";
import { inwardNumbering, lockInwardNumbering, renumberInwardDate } from "./numbering";
import { writeInwardRecord } from "./record-store";
import type { InwardFormData } from "./schema";

export class InwardSaveError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}


/**
 * Create or update an Inward / Outward entry in one transaction: Sample
 * Details, the design (Plain Body – Yes / No, the design types with their
 * fields), the L, a, b of Body 1 … N, Roy Body 1 … n and Chessboard Body
 * 1 … n, Sample Output files and Remarks. On update the design and readings
 * are replaced; the previous version is kept in the audit log.
 *
 * Entries saved with the earlier form keep what this form does not show
 * (linked lab sample, Lab Recreation Attempts, Roy Body formulations, design
 * patterns that are not design types); their per-body design is replaced by
 * the design chosen here.
 */
export async function saveInward(args: {
  id?: string;
  data: InwardFormData;
  user: CurrentUser;
  /** Create only: the form still shows the suggested Slab Number (allocate it again at save). */
  autoSlab?: boolean;
}): Promise<{ id: string; serialNo: number; slabNumber: number | null; removedKeys: string[] }> {
  const { id, data, user, autoSlab } = args;
  const canOverride = can(user, "inward.overrideNumbers");
  const canAddMaster = can(user, "master.addFromForm");
  const canRemoveFiles = can(user, "attachment.remove");

  return prisma
    .$transaction(
      async (tx) => {
        await lockInwardNumbering(tx);

        const patternSelect = { pattern: { select: { id: true, code: true, label: true } } } as const;
        const existing = id
          ? await tx.inwardOutwardEntry.findUnique({
              where: { id },
              include: {
                attachments: { select: { id: true, storageKey: true } },
                designPatterns: { select: patternSelect, orderBy: { sortOrder: "asc" } },
                bodies: { select: { designPatterns: { select: patternSelect, orderBy: { sortOrder: "asc" } } }, orderBy: { bodyIndex: "asc" } },
              },
            })
          : null;
        if (id && !existing) throw new InwardSaveError("This entry no longer exists — it may have been deleted.");

        const resolve = async (code: MasterCode, ref: MasterRef | null | undefined) => {
          if (ref && !ref.id && ref.label.trim() && !canAddMaster) {
            throw new InwardSaveError(`You cannot add new list values (“${ref.label}”). Pick one from the list.`);
          }
          return resolveMasterRef(tx, code, ref, user.id);
        };

        // ── date and numbers (S.No. 1, 2, 3 … within the date) ──────────────
        const entryDate = dateOnly(data.entryDate ?? (existing ? existing.entryDate.toISOString().slice(0, 10) : plantToday()));
        const { serialNo, slabNumber, moved, fieldErrors } = await allocateNumbers(inwardNumbering, tx, {
          date: entryDate,
          existing: existing && { id: existing.id, date: existing.entryDate, serialNo: existing.serialNo, slabNumber: existing.slabNumber },
          typedSlab: data.slabNumber,
          autoSlab: !!autoSlab,
          canOverride,
        });
        if (Object.keys(fieldErrors).length) throw new InwardSaveError("Duplicate number — see the highlighted fields.", fieldErrors);

        // ── the entry ────────────────────────────────────────────────────────
        const n = data.numberOfBodies ?? 0;
        const base = {
          serialNo,
          slabNumber,
          entryDate,
          companyId: await resolve(MASTER.COMPANY, data.company),
          designNameId: await resolve(MASTER.DESIGN_NAME, data.designName),
          // A name typed before the Design Names list existed is now the list value.
          legacySampleDesignName: null,
          designCategory: data.plainBody === null ? null : data.plainBody ? ("PLAIN_BODY" as const) : ("NON_PLAIN_BODY" as const),
          numberOfBodies: data.numberOfBodies,
          remarks: data.remarks,
          updatedById: user.id,
        };
        const entry = existing
          ? await tx.inwardOutwardEntry.update({ where: { id: existing.id }, data: base })
          : await tx.inwardOutwardEntry.create({ data: { ...base, createdById: user.id } });

        if (existing) {
          await tx.inwardDesignDetail.deleteMany({ where: { entryId: entry.id } });
          await tx.inwardDesignPattern.deleteMany({ where: { entryId: entry.id } });
          await tx.inwardMeasurement.deleteMany({ where: { entryId: entry.id } });
          // The earlier form's per-body design is replaced by the design chosen here.
          if (data.plainBody !== null) await tx.inwardBody.deleteMany({ where: { entryId: entry.id } });
          // Roy Body formulations of the earlier form: kept for Body 1 … N.
          await tx.formulation.deleteMany({ where: { inwardEntryId: entry.id, bodyIndex: { gt: Math.max(n, 1) } } });
        }

        // ── design types (Plain Body – No) ───────────────────────────────────
        type TypeRow = {
          type: DesignTypeKey;
          bodyCount?: number | null;
          vein?: InwardFormData["kreos"];
          colours?: InwardFormData["carrara"]["colours"];
        };
        const typeRows: TypeRow[] = [];
        for (const type of data.plainBody === false ? data.designTypes : []) {
          if (type === "ROY_BODY") typeRows.push({ type, bodyCount: data.royBody.count });
          if (type === "CHESSBOARD") typeRows.push({ type, bodyCount: data.chessboard.count });
          if (type === "KREOS") typeRows.push({ type, vein: data.kreos, colours: data.kreos.colours });
          if (type === "VEIN") typeRows.push({ type, vein: data.vein, colours: data.vein.colours });
          if (type === "CARRARA") typeRows.push({ type, colours: data.carrara.colours });
        }
        // Patterns of the earlier form that are not design types stay (Plain Body – No).
        const keep =
          existing && data.plainBody === false
            ? otherPatternIds([...existing.designPatterns, ...existing.bodies.flatMap((b) => b.designPatterns)].map((p) => p.pattern))
            : [];
        const patternIds: string[] = [];
        for (const t of typeRows) patternIds.push(await patternFor(tx, t.type, user.id));
        for (const pid of keep) if (!patternIds.includes(pid)) patternIds.push(pid);
        if (patternIds.length) {
          await tx.inwardDesignPattern.createMany({ data: patternIds.map((patternId, k) => ({ entryId: entry.id, patternId, sortOrder: k })) });
        }
        for (const t of typeRows) {
          const veinOn = t.vein?.veinPresent === true;
          const row = await tx.inwardDesignDetail.create({
            data: {
              entryId: entry.id,
              type: t.type,
              bodyCount: t.bodyCount ?? null,
              veinPresent: t.vein ? t.vein.veinPresent : null,
              mixerTypeId: veinOn ? await resolve(MASTER.MIXER_TYPE, t.vein!.mixerType) : null,
            },
          });
          if (veinOn) {
            const ids: string[] = [];
            for (const ref of t.vein!.veinDetails) {
              const did = await resolve(MASTER.VEIN_DETAIL, ref);
              if (did && !ids.includes(did)) ids.push(did);
            }
            if (ids.length) {
              await tx.inwardDesignVeinDetail.createMany({ data: ids.map((detailId, k) => ({ designDetailId: row.id, detailId, sortOrder: k })) });
            }
          }
          // Carrara always; Kreos / Vein only with Vein Present – Yes.
          if (t.type === "CARRARA" || veinOn) {
            const seen = new Set<string>();
            let k = 0;
            for (const c of t.colours ?? []) {
              const cid = await resolve(MASTER.PIGMENT, c.colour);
              if (!cid || seen.has(cid)) continue;
              seen.add(cid);
              await tx.inwardDesignColour.create({
                data: { designDetailId: row.id, colourId: cid, quantity: c.quantity === null ? null : new Prisma.Decimal(c.quantity), sortOrder: k++ },
              });
            }
          }
        }

        // ── L, a, b ──────────────────────────────────────────────────────────
        const rows: Prisma.InwardMeasurementCreateManyInput[] = [];
        const add = (part: "MAIN" | "ROY_BODY" | "CHESSBOARD", list: LabReadingData[], count: number) =>
          list.slice(0, count).forEach((r, k) => {
            if (!readingIsEmpty(r)) rows.push({ entryId: entry.id, part, bodyIndex: k + 1, l: r.l, a: r.a, b: r.b });
          });
        add("MAIN", data.bodies, n);
        if (typeRows.some((t) => t.type === "ROY_BODY")) add("ROY_BODY", data.royBodies, data.royBody.count ?? 0);
        if (typeRows.some((t) => t.type === "CHESSBOARD")) add("CHESSBOARD", data.chessboardBodies, data.chessboard.count ?? 0);
        if (rows.length) await tx.inwardMeasurement.createMany({ data: rows });

        // ── Sample Output (files) ────────────────────────────────────────────
        const wanted = new Set(data.attachmentIds);
        const current = existing?.attachments ?? [];
        const toRemove = current.filter((a) => !wanted.has(a.id));
        if (toRemove.length && !canRemoveFiles) throw new InwardSaveError("You do not have permission to remove attached files.");
        const newIds = [...wanted].filter((aid) => !current.some((a) => a.id === aid));
        if (newIds.length) {
          const ok = await tx.sampleAttachment.updateMany({
            where: { id: { in: newIds }, sampleId: null, productionSampleId: null, inwardEntryId: null, uploadedById: user.id },
            data: { inwardEntryId: entry.id },
          });
          if (ok.count !== newIds.length) throw new InwardSaveError("One of the uploaded files has expired. Please upload it again.");
        }
        if (toRemove.length) await tx.sampleAttachment.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });

        // Moved to another date: close the gap it left there.
        if (moved) for (const eid of await renumberInwardDate(tx, existing!.entryDate)) await writeInwardRecord(tx, eid);

        // ── Sample Inward / Outward Database: the complete copy of this entry ─
        await writeInwardRecord(tx, entry.id);

        await audit(tx, {
          entityType: "InwardOutwardEntry",
          entityId: entry.id,
          action: existing ? "UPDATE" : "CREATE",
          summary: `Inward / Outward S.No. ${serialNo}${slabNumber ? ` / Slab ${slabNumber}` : ""}`,
          snapshot: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          userId: user.id,
        });

        return { id: entry.id, serialNo, slabNumber, removedKeys: toRemove.map((a) => a.storageKey) };
      },
      { timeout: 20_000, maxWait: 10_000 },
    )
    .catch((e) => {
      if (e instanceof MasterValueError) throw new InwardSaveError(e.message);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("slab")) throw new InwardSaveError("That slab number was just taken. Please save again.", { slabNumber: "Already used." });
        throw new InwardSaveError("That S.No. was just taken. Please save again.", { serialNo: "Already used." });
      }
      throw e;
    });
}

/** Permanently delete an entry, after writing its full record to the audit log. */
export async function deleteInward(id: string, user: CurrentUser): Promise<{ serialNo: number; removedKeys: string[] }> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.inwardOutwardEntry.findUnique({ where: { id }, include: inwardInclude });
    if (!snapshot) throw new InwardSaveError("This entry was already deleted.");
    await audit(tx, {
      entityType: "InwardOutwardEntry",
      entityId: id,
      action: "DELETE",
      summary: `Deleted Inward / Outward S.No. ${snapshot.serialNo}${snapshot.slabNumber ? ` / Slab ${snapshot.slabNumber}` : ""}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    await lockInwardNumbering(tx);
    await tx.inwardOutwardEntry.delete({ where: { id } }); // design, readings, files and its database copy cascade
    // S.No. of that date stay 1 … k.
    for (const eid of await renumberInwardDate(tx, snapshot.entryDate)) await writeInwardRecord(tx, eid);
    return { serialNo: snapshot.serialNo, removedKeys: snapshot.attachments.map((a) => a.storageKey) };
  });
}

export { inwardInclude };

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import type { CurrentUser } from "@/lib/session";
import { allocateNumbers, dateOnly } from "@/modules/forms/date-numbering";
import { otherPatternIds, patternFor } from "@/modules/forms/design-server";
import type { DesignTypeKey } from "@/modules/forms/design-types";
import { readingIsEmpty, type LabReadingData } from "@/modules/forms/fields";
import { materialsAreEmpty, type MaterialsData } from "@/modules/forms/materials";
import { MASTER, type MasterCode } from "@/modules/master-data/catalog";
import { MasterValueError, resolveMasterRef } from "@/modules/master-data/service";
import type { MasterRef } from "@/modules/master-data/types";
import { sampleInclude } from "./include";
import { labNumbering, lockLabNumbering, renumberLabDate } from "./numbering";
import { writeLabRecord } from "./record-store";
import { writeInwardRecord } from "@/modules/inward-outward/record-store";
import type { LabFormData } from "./schema";

/** Today's date in the plant's time zone (YYYY-MM-DD). */
export const todayInPlant = () => plantToday();

export class LabSaveError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const decimal = (n: number | null) => (n === null ? null : new Prisma.Decimal(n));

type Resolve = (code: MasterCode, ref: MasterRef | null | undefined) => Promise<string | null>;

/** Samples whose S.No. changed: refresh their database copies (and their inward entries' copies, which show the lab S.No.). */
async function refreshRenumbered(tx: Tx, ids: string[]) {
  for (const sid of ids) {
    await writeLabRecord(tx, sid);
    const inward = await tx.inwardOutwardEntry.findFirst({ where: { labSampleId: sid }, select: { id: true } });
    if (inward) await writeInwardRecord(tx, inward.id);
  }
}

/**
 * One body's Material Details as a formulation (role MAIN_BODY for Body i,
 * ROY_BODY / CHESSBOARD_BODY for Roy / Chessboard Body k). Nothing entered →
 * nothing written.
 */
async function writeMaterials(
  tx: Tx,
  resolve: Resolve,
  sampleId: string,
  role: "MAIN_BODY" | "ROY_BODY" | "CHESSBOARD_BODY",
  bodyIndex: number,
  m: MaterialsData,
) {
  if (materialsAreEmpty(m)) return;
  const f = await tx.formulation.create({ data: { sampleId, role, bodyIndex } });
  const rows: Prisma.FormulationComponentCreateManyInput[] = [];
  const unit = (r: { unit: "GRAMS" | "PERCENT" | null; quantity: number | null }) => r.unit ?? (r.quantity !== null ? ("GRAMS" as const) : null);
  let order = 0;
  for (const r of m.resins) {
    const materialId = await resolve(MASTER.RESIN, r.material);
    if (materialId) rows.push({ formulationId: f.id, kind: "RESIN", materialId, unit: unit(r), quantity: decimal(r.quantity), sortOrder: order++ });
  }
  for (const r of m.grits) {
    const materialId = await resolve(MASTER.GRIT, r.material);
    if (!materialId) continue;
    const sizeId = await resolve(MASTER.GRIT_SIZE, r.size);
    rows.push({ formulationId: f.id, kind: "GRIT", materialId, sizeId, unit: unit(r), quantity: decimal(r.quantity), sortOrder: order++ });
  }
  for (const r of m.fillers) {
    const materialId = await resolve(MASTER.FILLER, r.material);
    if (materialId) rows.push({ formulationId: f.id, kind: "FILLER", materialId, unit: unit(r), quantity: decimal(r.quantity), sortOrder: order++ });
  }
  for (const r of m.pigments) {
    const materialId = await resolve(MASTER.PIGMENT, r.colour);
    if (materialId) rows.push({ formulationId: f.id, kind: "PIGMENT", materialId, unit: unit(r), quantity: decimal(r.quantity), sortOrder: order++ });
  }
  if (rows.length) await tx.formulationComponent.createMany({ data: rows });

  const additives: Prisma.FormulationAdditiveCreateManyInput[] = [];
  for (const r of m.additives) {
    const additiveId = await resolve(MASTER.ADDITIVE, r.colour);
    if (additiveId && !additives.some((a) => a.additiveId === additiveId)) {
      additives.push({ formulationId: f.id, additiveId, quantity: decimal(r.quantity), sortOrder: additives.length });
    }
  }
  if (additives.length) await tx.formulationAdditive.createMany({ data: additives });
}

/**
 * Create or update a lab sample in one transaction: Basic Information, the
 * design (Plain Body – Yes / No, the design types with their fields), the
 * Material Details of Body 1 … N, Roy Body 1 … n and Chessboard Body 1 … n,
 * their L, a, b (Post Press / Post Polish), Sample Output files and Remarks.
 * On update these are replaced; the previous version is kept in the audit log.
 *
 * The design is also written the way the Dashboard, Reports and Downloads
 * read it: every body (SampleBody 1 … N) and the sample carry Plain / Non-Plain
 * Body and the selected types as Design Patterns values.
 *
 * Samples saved with the earlier form keep what this form does not show:
 * Physical Sample Available? and the linked Inward / Outward entry, each
 * body's Vein (Mixer Type, How Vein Introduced, Vein details), the Roy Body
 * formulations of Body 1 … N, and design patterns that are not design types.
 */
export async function saveLabSample(args: {
  id?: string;
  data: LabFormData;
  user: CurrentUser;
  /** Create only: the form still shows the suggested Slab Number (allocate it again at save). */
  autoSlab?: boolean;
}): Promise<{ id: string; serialNo: number; slabNumber: number | null; removedKeys: string[] }> {
  const { id, data, user, autoSlab } = args;
  const canOverride = can(user, "sample.overrideNumbers");
  const canDate = can(user, "sample.changeDate");
  const canAddMaster = can(user, "master.addFromForm");
  const canRemoveFiles = can(user, "attachment.remove");

  return prisma
    .$transaction(
      async (tx) => {
        await lockLabNumbering(tx);

        const patternSelect = { pattern: { select: { id: true, code: true, label: true } } } as const;
        const existing = id
          ? await tx.labSample.findUnique({
              where: { id },
              include: {
                attachments: { select: { id: true, storageKey: true } },
                designPatterns: { select: patternSelect, orderBy: { sortOrder: "asc" } },
                veinMethods: { select: { methodId: true }, orderBy: { sortOrder: "asc" } },
                bodies: { include: { designPatterns: { select: patternSelect, orderBy: { sortOrder: "asc" } } }, orderBy: { bodyIndex: "asc" } },
              },
            })
          : null;
        if (id && !existing) throw new LabSaveError("This sample no longer exists — it may have been deleted.");

        const resolve: Resolve = async (code, ref) => {
          if (ref && !ref.id && ref.label.trim() && !canAddMaster) {
            throw new LabSaveError(`You cannot add new list values (“${ref.label}”). Pick one from the list.`);
          }
          return resolveMasterRef(tx, code, ref, user.id);
        };

        // ── date and numbers (S.No. 1, 2, 3 … within the date) ──────────────
        const keptDate = existing ? existing.sampleDate.toISOString().slice(0, 10) : plantToday();
        const sampleDate = dateOnly(canDate ? (data.sampleDate ?? keptDate) : keptDate);
        const { serialNo, slabNumber, moved, fieldErrors } = await allocateNumbers(labNumbering, tx, {
          date: sampleDate,
          existing: existing && { id: existing.id, date: existing.sampleDate, serialNo: existing.serialNo, slabNumber: existing.slabNumber },
          typedSlab: data.slabNumber,
          autoSlab: !!autoSlab,
          canOverride,
        });
        if (Object.keys(fieldErrors).length) throw new LabSaveError("Duplicate number — see the highlighted fields.", fieldErrors);

        // ── the sample ───────────────────────────────────────────────────────
        const n = data.numberOfBodies ?? 0;
        const designCategory = data.plainBody === null ? null : data.plainBody ? ("PLAIN_BODY" as const) : ("NON_PLAIN_BODY" as const);
        const base = {
          serialNo,
          slabNumber,
          sampleDate,
          status: "SUBMITTED" as const,
          designNameId: await resolve(MASTER.DESIGN_NAME, data.designName),
          // A name typed before the Design Names list existed is now the list value.
          legacyDesignName: null,
          numberOfBodies: data.numberOfBodies,
          designCategory,
          remarks: data.remarks,
          updatedById: user.id,
        };
        const sample = existing
          ? await tx.labSample.update({ where: { id: existing.id }, data: base })
          : await tx.labSample.create({ data: { ...base, createdById: user.id } });

        if (existing) {
          await tx.sampleDesignDetail.deleteMany({ where: { sampleId: sample.id } });
          await tx.sampleDesignPattern.deleteMany({ where: { sampleId: sample.id } });
          await tx.labMeasurement.deleteMany({ where: { sampleId: sample.id } });
          await tx.formulation.deleteMany({ where: { sampleId: sample.id, role: { in: ["MAIN_BODY", "ROY_BODY", "CHESSBOARD_BODY"] } } });
          // Roy Body formulations of the earlier form: kept for Body 1 … N.
          await tx.formulation.deleteMany({ where: { sampleId: sample.id, bodyIndex: { gt: Math.max(n, 1) } } });
          await tx.sampleBody.deleteMany({ where: { sampleId: sample.id, bodyIndex: { gt: n } } });
        }

        // ── design: the selected types, as Design Patterns values too ───────
        const types: DesignTypeKey[] = data.plainBody === false ? data.designTypes : [];
        const typePatternIds: string[] = [];
        for (const t of types) typePatternIds.push(await patternFor(tx, t, user.id));
        const withOthers = (others: string[]) => [...typePatternIds, ...others.filter((p) => !typePatternIds.includes(p))];
        // Earlier-form patterns that are not design types stay (Plain Body – No only).
        const keepAll =
          existing && data.plainBody === false
            ? otherPatternIds([...existing.designPatterns, ...existing.bodies.flatMap((b) => b.designPatterns)].map((p) => p.pattern))
            : [];
        const samplePatterns = withOthers(keepAll);
        if (samplePatterns.length) {
          await tx.sampleDesignPattern.createMany({ data: samplePatterns.map((patternId, k) => ({ sampleId: sample.id, patternId, sortOrder: k })) });
        }

        // Body 1 … N carry the same design (what Reports / Downloads read per body).
        const legacyWhole = existing && existing.bodies.length === 0; // saved before body-wise entry
        const legacyOthers = legacyWhole && data.plainBody === false ? otherPatternIds(existing.designPatterns.map((p) => p.pattern)) : [];
        for (let i = 1; i <= n; i++) {
          const had = existing?.bodies.find((b) => b.bodyIndex === i);
          const others = data.plainBody === false ? (had ? otherPatternIds(had.designPatterns.map((p) => p.pattern)) : legacyOthers) : [];
          const body = had
            ? await tx.sampleBody.update({ where: { id: had.id }, data: { designCategory } })
            : await tx.sampleBody.create({
                data: {
                  sampleId: sample.id,
                  bodyIndex: i,
                  designCategory,
                  // Saved before body-wise entry: its one Vein applied to every body — keep showing it.
                  ...(legacyWhole ? { mixerTypeId: existing.mixerTypeId, hasVein: existing.hasVein, legacyVeinNotes: existing.veinNotes } : {}),
                },
              });
          if (had) await tx.sampleBodyDesignPattern.deleteMany({ where: { bodyId: body.id } });
          const ids = withOthers(others);
          if (ids.length) await tx.sampleBodyDesignPattern.createMany({ data: ids.map((patternId, k) => ({ bodyId: body.id, patternId, sortOrder: k })) });
          if (!had && legacyWhole && existing.veinMethods.length) {
            await tx.sampleBodyVeinMethod.createMany({ data: existing.veinMethods.map((m, k) => ({ bodyId: body.id, methodId: m.methodId, sortOrder: k })) });
          }
        }

        // ── the design types' own fields ─────────────────────────────────────
        for (const type of types) {
          const vein = type === "KREOS" ? data.kreos : type === "VEIN" ? data.vein : null;
          const veinOn = vein?.veinPresent === true;
          const row = await tx.sampleDesignDetail.create({
            data: {
              sampleId: sample.id,
              type,
              bodyCount: type === "ROY_BODY" ? data.royBody.count : type === "CHESSBOARD" ? data.chessboard.count : null,
              veinPresent: vein ? vein.veinPresent : null,
              mixerTypeId: veinOn ? await resolve(MASTER.MIXER_TYPE, vein.mixerType) : null,
            },
          });
          if (veinOn) {
            const ids: string[] = [];
            for (const ref of vein.veinDetails) {
              const did = await resolve(MASTER.VEIN_DETAIL, ref);
              if (did && !ids.includes(did)) ids.push(did);
            }
            if (ids.length) await tx.sampleDesignVeinDetail.createMany({ data: ids.map((detailId, k) => ({ designDetailId: row.id, detailId, sortOrder: k })) });
          }
          // Carrara always; Kreos / Vein only with Vein Present – Yes.
          const colours = type === "CARRARA" ? data.carrara.colours : veinOn ? vein.colours : [];
          const seen: string[] = [];
          for (const c of colours) {
            const cid = await resolve(MASTER.PIGMENT, c.colour);
            if (!cid || seen.includes(cid)) continue;
            seen.push(cid);
            await tx.sampleDesignColour.create({ data: { designDetailId: row.id, colourId: cid, quantity: decimal(c.quantity), sortOrder: seen.length - 1 } });
          }
        }

        // ── Material Details ─────────────────────────────────────────────────
        const royN = types.includes("ROY_BODY") ? (data.royBody.count ?? 0) : 0;
        const chessN = types.includes("CHESSBOARD") ? (data.chessboard.count ?? 0) : 0;
        for (const [k, m] of data.materials.slice(0, n).entries()) await writeMaterials(tx, resolve, sample.id, "MAIN_BODY", k + 1, m);
        for (const [k, m] of data.royBody.materials.slice(0, royN).entries()) await writeMaterials(tx, resolve, sample.id, "ROY_BODY", k + 1, m);
        for (const [k, m] of data.chessboard.materials.slice(0, chessN).entries()) await writeMaterials(tx, resolve, sample.id, "CHESSBOARD_BODY", k + 1, m);

        // ── L, a, b ──────────────────────────────────────────────────────────
        const readings: Prisma.LabMeasurementCreateManyInput[] = [];
        const add = (part: "MAIN" | "ROY_BODY" | "CHESSBOARD", list: { postPress: LabReadingData; postPolish: LabReadingData }[], count: number) =>
          list.slice(0, count).forEach((r, k) => {
            for (const [stage, v] of [["POST_PRESS", r.postPress], ["POST_POLISH", r.postPolish]] as const) {
              if (!readingIsEmpty(v)) readings.push({ sampleId: sample.id, part, stage, bodyIndex: k + 1, l: v.l, a: v.a, b: v.b });
            }
          });
        add("MAIN", data.readings, n);
        add("ROY_BODY", data.royReadings, royN);
        add("CHESSBOARD", data.chessboardReadings, chessN);
        if (readings.length) await tx.labMeasurement.createMany({ data: readings });

        // ── Sample Output (files) ────────────────────────────────────────────
        const wanted = new Set(data.attachmentIds);
        const current = existing?.attachments ?? [];
        const toRemove = current.filter((a) => !wanted.has(a.id));
        if (toRemove.length && !canRemoveFiles) throw new LabSaveError("You do not have permission to remove attached files.");
        const newIds = [...wanted].filter((aid) => !current.some((a) => a.id === aid));
        if (newIds.length) {
          const ok = await tx.sampleAttachment.updateMany({
            where: { id: { in: newIds }, sampleId: null, productionSampleId: null, inwardEntryId: null, uploadedById: user.id },
            data: { sampleId: sample.id },
          });
          if (ok.count !== newIds.length) throw new LabSaveError("One of the uploaded files has expired. Please upload it again.");
        }
        if (toRemove.length) await tx.sampleAttachment.deleteMany({ where: { id: { in: toRemove.map((a) => a.id) } } });

        // Moved to another date: close the gap it left there.
        if (moved) await refreshRenumbered(tx, await renumberLabDate(tx, existing!.sampleDate));

        // ── Lab Sample Database: the complete copy of this sample ───────────
        await writeLabRecord(tx, sample.id);

        await audit(tx, {
          entityType: "LabSample",
          entityId: sample.id,
          action: existing ? "UPDATE" : "CREATE",
          summary: `Lab Sample S.No. ${serialNo}${slabNumber ? ` / Slab ${slabNumber}` : ""}`,
          snapshot: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
          userId: user.id,
        });

        return { id: sample.id, serialNo, slabNumber, removedKeys: toRemove.map((a) => a.storageKey) };
      },
      { timeout: 30_000, maxWait: 10_000 },
    )
    .catch((e) => {
      if (e instanceof MasterValueError) throw new LabSaveError(e.message);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("slab")) throw new LabSaveError("That slab number was just taken. Please save again.", { slabNumber: "Already used." });
        throw new LabSaveError("That S.No. was just taken. Please save again.", { serialNo: "Already used." });
      }
      throw e;
    });
}

/** Permanently delete a sample, after writing its full record to the audit log. */
export async function deleteLabSample(id: string, user: CurrentUser): Promise<{ serialNo: number; removedKeys: string[] }> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.labSample.findUnique({ where: { id }, include: sampleInclude });
    if (!snapshot) throw new LabSaveError("This sample was already deleted.");
    await audit(tx, {
      entityType: "LabSample",
      entityId: id,
      action: "DELETE",
      summary: `Deleted Lab Sample S.No. ${snapshot.serialNo}${snapshot.slabNumber ? ` / Slab ${snapshot.slabNumber}` : ""}`,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      userId: user.id,
    });
    // Design, materials, readings, files and its Lab Sample Database copy cascade;
    // a linked Inward / Outward entry stays (unlinked) — its copy is refreshed.
    await lockLabNumbering(tx);
    await tx.labSample.delete({ where: { id } });
    if (snapshot.inwardEntry) await writeInwardRecord(tx, snapshot.inwardEntry.id);
    // S.No. of that date stay 1 … k.
    await refreshRenumbered(tx, await renumberLabDate(tx, snapshot.sampleDate));
    return { serialNo: snapshot.serialNo, removedKeys: snapshot.attachments.map((a) => a.storageKey) };
  });
}

export { sampleInclude };

import "server-only";
import { Prisma, type ComponentKind, type FormulationRole } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { MASTER, VALUE_CODE, type MasterCode } from "@/modules/master-data/catalog";
import type { MasterRef } from "@/modules/master-data/types";
import type { FormulationData, RoyBodyData } from "@/modules/samples/schema";

/**
 * Writing formulations (Resin / Grits / Filler / Pigment rows) for any owner,
 * and the complete Roy Body (formulation + Number of Bodies + Vein + L/a/b).
 * Lab samples and inward/outward entries both call this — one implementation
 * of the formulation rules for the whole ERP.
 */
export type FormulationOwner = { sampleId: string } | { inwardEntryId: string } | { parentId: string };

export type RefResolver = (code: MasterCode, ref: MasterRef | null | undefined) => Promise<string | null>;

const KIND_BY_KEY: Record<keyof FormulationData, { kind: ComponentKind; list: MasterCode }> = {
  resins: { kind: "RESIN", list: MASTER.RESIN },
  grits: { kind: "GRIT", list: MASTER.GRIT },
  fillers: { kind: "FILLER", list: MASTER.FILLER },
  pigments: { kind: "PIGMENT", list: MASTER.PIGMENT },
};

const rowIsEmpty = (r: FormulationData["resins"][number]) => !r.material && !r.size && r.quantity === null;

/** Whether a formulation has anything worth storing. */
export function formulationHasData(f: FormulationData): boolean {
  return (Object.keys(KIND_BY_KEY) as (keyof FormulationData)[]).some((k) => f[k].some((r) => !rowIsEmpty(r)));
}

const labRowEmpty = (r: { l: number | null; a: number | null; b: number | null }) => r.l === null && r.a === null && r.b === null;

/** Whether a Roy Body has anything worth storing (formulation or any detail). */
export function royBodyHasData(r: RoyBodyData): boolean {
  return (
    formulationHasData(r) ||
    r.numberOfBodies !== null ||
    r.hasVein !== null ||
    !!r.mixerType ||
    r.veinMethods.length > 0 ||
    !!r.veinNotes ||
    formulationHasData(r.veinRoyBody) ||
    r.postPress.some((x) => !labRowEmpty(x)) ||
    r.postPolish.some((x) => !labRowEmpty(x))
  );
}

async function writeComponents(tx: Tx, formulationId: string, data: FormulationData, resolve: RefResolver) {
  const rows: Prisma.FormulationComponentCreateManyInput[] = [];
  for (const key of Object.keys(KIND_BY_KEY) as (keyof FormulationData)[]) {
    const { kind, list } = KIND_BY_KEY[key];
    let order = 0;
    for (const r of data[key]) {
      if (rowIsEmpty(r)) continue;
      rows.push({
        formulationId,
        kind,
        materialId: await resolve(list, r.material),
        sizeId: kind === "GRIT" ? await resolve(MASTER.GRIT_SIZE, r.size) : null,
        // Quantities are entered in grams. A % value saved before the unit
        // option was removed keeps its unit, so old records stay truthful.
        unit: r.quantity === null ? null : r.unit === "PERCENT" ? "PERCENT" : "GRAMS",
        quantity: r.quantity === null ? null : new Prisma.Decimal(r.quantity),
        sortOrder: order++,
      });
    }
  }
  if (rows.length) await tx.formulationComponent.createMany({ data: rows });
}

/** A plain formulation (Main Body, Vein Roy Body, …). */
export async function writeFormulation(
  tx: Tx,
  owner: FormulationOwner,
  role: FormulationRole,
  data: FormulationData,
  resolve: RefResolver,
  /** Which body (1 … n) of the owner this formulation belongs to. */
  bodyIndex = 1,
): Promise<void> {
  if (!formulationHasData(data)) return;
  const formulation = await tx.formulation.create({ data: { ...owner, role, bodyIndex } });
  await writeComponents(tx, formulation.id, data, resolve);
}

/**
 * The Roy Body opened from Design: formulation + Number of Bodies + Vein
 * (Mixer Type, methods, details, and a nested Roy Body formulation when ROY
 * BODY is one of its methods) + Post Press / Post Polish L/a/b per body.
 */
export async function writeRoyBody(
  tx: Tx,
  owner: FormulationOwner,
  role: FormulationRole,
  r: RoyBodyData,
  resolve: RefResolver,
  /** Which body (1 … n) of the owner opened this Roy Body. */
  bodyIndex = 1,
): Promise<void> {
  if (!royBodyHasData(r)) return;
  const veinApplies = r.hasVein !== false;

  const methodIds: string[] = [];
  if (veinApplies) {
    for (const ref of r.veinMethods) {
      const id = await resolve(MASTER.VEIN_METHOD, ref);
      if (id && !methodIds.includes(id)) methodIds.push(id);
    }
  }

  const formulation = await tx.formulation.create({
    data: {
      ...owner,
      role,
      bodyIndex,
      numberOfBodies: r.numberOfBodies,
      hasVein: r.hasVein,
      veinNotes: veinApplies ? r.veinNotes : null,
      mixerTypeId: await resolve(MASTER.MIXER_TYPE, r.mixerType),
    },
  });
  await writeComponents(tx, formulation.id, r, resolve);

  if (methodIds.length) {
    await tx.formulationVeinMethod.createMany({
      data: methodIds.map((methodId, i) => ({ formulationId: formulation.id, methodId, sortOrder: i })),
    });
    const coded = await tx.masterValue.findMany({ where: { id: { in: methodIds }, code: VALUE_CODE.ROY_BODY }, select: { id: true } });
    if (coded.length) {
      await writeFormulation(tx, { parentId: formulation.id }, "VEIN_ROY_BODY", r.veinRoyBody, resolve);
    }
  }

  const n = r.numberOfBodies ?? 0;
  const rows: Prisma.FormulationMeasurementCreateManyInput[] = [];
  for (const [stage, list] of [
    ["POST_PRESS", r.postPress],
    ["POST_POLISH", r.postPolish],
  ] as const) {
    list.slice(0, n).forEach((m, i) => {
      if (labRowEmpty(m)) return;
      rows.push({ formulationId: formulation.id, stage, bodyIndex: i + 1, l: m.l, a: m.a, b: m.b });
    });
  }
  if (rows.length) await tx.formulationMeasurement.createMany({ data: rows });
}

const valueSelect = { select: { id: true, label: true, code: true, isActive: true } } as const;

const componentsInclude = {
  include: { material: valueSelect, size: valueSelect },
  orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
} satisfies Prisma.Formulation$componentsArgs;

/** Prisma include for reading formulations back — Roy Body details and the nested Vein Roy Body too. */
export const formulationInclude = {
  components: componentsInclude,
  mixerType: valueSelect,
  veinMethods: { include: { method: valueSelect }, orderBy: { sortOrder: "asc" } },
  measurements: { orderBy: [{ stage: "asc" }, { bodyIndex: "asc" }] },
  children: { include: { components: componentsInclude } },
} satisfies Prisma.FormulationInclude;

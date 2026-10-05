import "server-only";
import { Prisma, type ComponentKind, type FormulationRole } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { MASTER, type MasterCode } from "@/modules/master-data/catalog";
import type { MasterRef } from "@/modules/master-data/types";
import type { FormulationData } from "@/modules/samples/schema";

/**
 * Writing a formulation (Resin / Grits / Filler / Pigment rows) for any owner.
 * Lab samples and inward/outward entries both call this — one implementation
 * of the formulation rules for the whole ERP.
 */
export type FormulationOwner = { sampleId: string } | { inwardEntryId: string };

export type RefResolver = (code: MasterCode, ref: MasterRef | null | undefined) => Promise<string | null>;

const KIND_BY_KEY: Record<keyof FormulationData, { kind: ComponentKind; list: MasterCode }> = {
  resins: { kind: "RESIN", list: MASTER.RESIN },
  grits: { kind: "GRIT", list: MASTER.GRIT },
  fillers: { kind: "FILLER", list: MASTER.FILLER },
  pigments: { kind: "PIGMENT", list: MASTER.PIGMENT },
};

const rowIsEmpty = (r: FormulationData["resins"][number]) => !r.material && !r.size && !r.unit && r.quantity === null;

/** Whether a formulation has anything worth storing. */
export function formulationHasData(f: FormulationData): boolean {
  return (Object.keys(KIND_BY_KEY) as (keyof FormulationData)[]).some((k) => f[k].some((r) => !rowIsEmpty(r)));
}

export async function writeFormulation(
  tx: Tx,
  owner: FormulationOwner,
  role: FormulationRole,
  data: FormulationData,
  resolve: RefResolver,
): Promise<void> {
  if (!formulationHasData(data)) return;
  const formulation = await tx.formulation.create({ data: { ...owner, role, bodyIndex: 1 } });
  const rows: Prisma.FormulationComponentCreateManyInput[] = [];
  for (const key of Object.keys(KIND_BY_KEY) as (keyof FormulationData)[]) {
    const { kind, list } = KIND_BY_KEY[key];
    let order = 0;
    for (const r of data[key]) {
      if (rowIsEmpty(r)) continue;
      rows.push({
        formulationId: formulation.id,
        kind,
        materialId: await resolve(list, r.material),
        sizeId: kind === "GRIT" ? await resolve(MASTER.GRIT_SIZE, r.size) : null,
        unit: r.unit,
        quantity: r.quantity === null ? null : new Prisma.Decimal(r.quantity),
        sortOrder: order++,
      });
    }
  }
  if (rows.length) await tx.formulationComponent.createMany({ data: rows });
}

/** Prisma include for reading formulations back with their master values. */
export const formulationInclude = {
  components: {
    include: {
      material: { select: { id: true, label: true, code: true, isActive: true } },
      size: { select: { id: true, label: true, code: true, isActive: true } },
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  },
} satisfies Prisma.FormulationInclude;

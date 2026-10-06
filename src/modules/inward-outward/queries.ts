import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  dec,
  royBodyToInput,
  toFormulationDTO,
  type FormulationDTO,
  type LabValueDTO,
  type ValueDTO,
} from "@/modules/samples/queries";
import { bodiesDesignText, bodyDesignsOrLegacy } from "@/modules/samples/bodies";
import { emptyLabRow } from "@/modules/samples/schema";
import { inwardInclude } from "./service";
import type { InwardFormInput } from "./schema";

/** Body i of an inward entry: its Design (+ Roy Body) and its L/a/b. */
export interface InwardBodyDTO {
  index: number;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  royBody: FormulationDTO | null;
  lab: LabValueDTO | null;
}

export interface InwardDetail {
  id: string;
  serialNo: number;
  entryDate: string;
  labSample: { id: string; serialNo: number; slabNumber: number | null; sampleDate: string } | null;
  company: ValueDTO | null;
  /** Sample Design Name as shown (the list value, or a name typed before the list existed). */
  sampleDesignName: string | null;
  /** The Design Names list value (null for a name typed before the list existed). */
  sampleDesignNameRef: ValueDTO | null;
  numberOfBodies: number | null;
  /** Body 1 … n. */
  bodies: InwardBodyDTO[];
  /** Saved before body-wise entry: one design for the whole entry, shown on every body. */
  legacyBodies: boolean;
  recreationAttempts: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type EntryWithAll = Prisma.InwardOutwardEntryGetPayload<{ include: typeof inwardInclude }>;

function inwardBodies(e: EntryWithAll): { bodies: InwardBodyDTO[]; legacy: boolean } {
  const roy = (i: number) => {
    const f = e.formulations.find((x) => x.role === "DESIGN_ROY_BODY" && x.bodyIndex === i);
    return f ? toFormulationDTO(f) : null;
  };
  const lab = (i: number): LabValueDTO | null => {
    const m = e.measurements.find((x) => x.bodyIndex === i);
    return m ? { l: dec(m.l), a: dec(m.a), b: dec(m.b) } : null;
  };
  if (e.bodies.length) {
    const n = Math.max(e.numberOfBodies ?? 0, ...e.bodies.map((b) => b.bodyIndex));
    const bodies = Array.from({ length: n }, (_, k): InwardBodyDTO => {
      const b = e.bodies.find((x) => x.bodyIndex === k + 1);
      return {
        index: k + 1,
        designCategory: b?.designCategory ?? null,
        designPatterns: b?.designPatterns.map((p) => p.pattern) ?? [],
        royBody: roy(k + 1),
        lab: lab(k + 1),
      };
    });
    return { bodies, legacy: false };
  }
  // Saved before body-wise entry: its one design (and Roy Body) on every body.
  const hasLegacy = e.designCategory !== null || e.designPatterns.length > 0 || e.formulations.length > 0;
  const maxLab = Math.max(0, ...e.measurements.map((m) => m.bodyIndex));
  const n = e.numberOfBodies ?? (hasLegacy || maxLab ? Math.max(1, maxLab) : 0);
  const bodies = Array.from({ length: n }, (_, k): InwardBodyDTO => ({
    index: k + 1,
    designCategory: e.designCategory,
    designPatterns: e.designPatterns.map((p) => p.pattern),
    royBody: roy(1),
    lab: lab(k + 1),
  }));
  return { bodies, legacy: hasLegacy && n > 0 };
}

export function toInwardDetail(e: EntryWithAll): InwardDetail {
  const { bodies, legacy } = inwardBodies(e);
  return {
    id: e.id,
    serialNo: e.serialNo,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    labSample: e.labSample
      ? { ...e.labSample, sampleDate: e.labSample.sampleDate.toISOString().slice(0, 10) }
      : null,
    company: e.company,
    sampleDesignName: e.designNameValue?.label ?? e.legacySampleDesignName,
    sampleDesignNameRef: e.designNameValue,
    numberOfBodies: e.numberOfBodies,
    bodies,
    legacyBodies: legacy,
    recreationAttempts: e.recreationAttempts,
    createdBy: e.createdBy?.name ?? null,
    updatedBy: e.updatedBy?.name ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function getInwardDetail(id: string): Promise<InwardDetail | null> {
  const e = await prisma.inwardOutwardEntry.findUnique({ where: { id }, include: inwardInclude });
  return e ? toInwardDetail(e) : null;
}

export function inwardReferencedIds(d: InwardDetail): string[] {
  const ids = new Set<string>();
  if (d.company) ids.add(d.company.id);
  if (d.sampleDesignNameRef) ids.add(d.sampleDesignNameRef.id);
  for (const b of d.bodies) {
    b.designPatterns.forEach((p) => ids.add(p.id));
    for (const c of [...(b.royBody?.components ?? []), ...(b.royBody?.veinRoyBody?.components ?? [])]) {
      if (c.material) ids.add(c.material.id);
      if (c.size) ids.add(c.size.id);
    }
    if (b.royBody?.mixerType) ids.add(b.royBody.mixerType.id);
    b.royBody?.veinMethods.forEach((m) => ids.add(m.id));
  }
  return [...ids];
}

export function inwardToFormInput(d: InwardDetail): InwardFormInput {
  const s = (v: string | null) => (v === null ? "" : String(Number(v)));
  return {
    entryDate: d.entryDate,
    serialNo: String(d.serialNo),
    labSampleId: d.labSample?.id ?? null,
    company: d.company ? { id: d.company.id, label: d.company.label } : null,
    // A name typed before the Design Names list existed opens as a new (Other…) name.
    sampleDesignName: d.sampleDesignNameRef
      ? { id: d.sampleDesignNameRef.id, label: d.sampleDesignNameRef.label }
      : d.sampleDesignName
        ? { label: d.sampleDesignName }
        : null,
    numberOfBodies: d.numberOfBodies !== null ? String(d.numberOfBodies) : d.bodies.length ? String(d.bodies.length) : "",
    bodies: d.bodies.map((b) => ({
      designCategory: b.designCategory ?? "",
      designPatterns: b.designPatterns.map((p) => ({ id: p.id, label: p.label })),
      designRoyBody: royBodyToInput(b.royBody),
      lab: b.lab ? { l: s(b.lab.l), a: s(b.lab.a), b: s(b.lab.b) } : emptyLabRow(),
    })),
    recreationAttempts: d.recreationAttempts ?? "",
  };
}

// ── registers ────────────────────────────────────────────────────────────────

export interface InwardRow {
  id: string;
  serialNo: number;
  entryDate: string;
  labSampleSerial: number | null;
  company: string | null;
  sampleDesignName: string | null;
  design: string;
  recreationAttempts: string | null;
}

export async function getRecentInward(take = 10): Promise<InwardRow[]> {
  const rows = await prisma.inwardOutwardEntry.findMany({
    take,
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    select: {
      id: true,
      serialNo: true,
      entryDate: true,
      legacySampleDesignName: true,
      designNameValue: { select: { label: true } },
      numberOfBodies: true,
      designCategory: true,
      recreationAttempts: true,
      company: { select: { label: true } },
      labSample: { select: { serialNo: true } },
      designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
      bodies: {
        orderBy: { bodyIndex: "asc" },
        select: {
          bodyIndex: true,
          designCategory: true,
          designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    serialNo: r.serialNo,
    entryDate: r.entryDate.toISOString().slice(0, 10),
    labSampleSerial: r.labSample?.serialNo ?? null,
    company: r.company?.label ?? null,
    sampleDesignName: r.designNameValue?.label ?? r.legacySampleDesignName,
    design: bodiesDesignText(
      bodyDesignsOrLegacy(
        r.bodies.map((b) => ({ bodyIndex: b.bodyIndex, designCategory: b.designCategory, patterns: b.designPatterns.map((p) => p.pattern) })),
        { designCategory: r.designCategory, patterns: r.designPatterns.map((p) => p.pattern) },
        r.numberOfBodies,
      ),
    ),
    recreationAttempts: r.recreationAttempts,
  }));
}

export interface RectificationRow {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  status: "DRAFT" | "SUBMITTED";
  remarks: string | null;
  createdBy: string | null;
}

/** Lab samples saved with Physical Sample Available? = No (not yet received). */
export async function getRectification(): Promise<RectificationRow[]> {
  const rows = await prisma.labSample.findMany({
    where: { physicalSamplePresent: false },
    orderBy: [{ sampleDate: "desc" }, { serialNo: "desc" }],
    take: 200,
    select: {
      id: true,
      serialNo: true,
      slabNumber: true,
      sampleDate: true,
      status: true,
      remarks: true,
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    serialNo: r.serialNo,
    slabNumber: r.slabNumber,
    sampleDate: r.sampleDate.toISOString().slice(0, 10),
    status: r.status,
    remarks: r.remarks,
    createdBy: r.createdBy?.name ?? null,
  }));
}

/** For the "linked to lab sample" banner when arriving from Sample Data Entry. */
export async function getLinkableSample(id: string) {
  const s = await prisma.labSample.findUnique({
    where: { id },
    select: {
      id: true,
      serialNo: true,
      slabNumber: true,
      sampleDate: true,
      inwardEntry: { select: { id: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    serialNo: s.serialNo,
    slabNumber: s.slabNumber,
    sampleDate: s.sampleDate.toISOString().slice(0, 10),
    existingEntryId: s.inwardEntry?.id ?? null,
  };
}

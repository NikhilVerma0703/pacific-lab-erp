import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { VALUE_CODE } from "@/modules/master-data/catalog";
import {
  dec,
  royBodyToInput,
  toFormulationDTO,
  type FormulationDTO,
  type ValueDTO,
} from "@/modules/samples/queries";
import { emptyLabRow } from "@/modules/samples/schema";
import { inwardInclude } from "./service";
import type { InwardFormInput } from "./schema";

export interface InwardDetail {
  id: string;
  serialNo: number;
  entryDate: string;
  labSample: { id: string; serialNo: number; slabNumber: number | null; sampleDate: string } | null;
  company: ValueDTO | null;
  sampleDesignName: string | null;
  numberOfBodies: number | null;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  measurements: { bodyIndex: number; l: string | null; a: string | null; b: string | null }[];
  royBody: FormulationDTO | null;
  recreationAttempts: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type EntryWithAll = Prisma.InwardOutwardEntryGetPayload<{ include: typeof inwardInclude }>;

export function toInwardDetail(e: EntryWithAll): InwardDetail {
  const roy = e.formulations.find((f) => f.role === "DESIGN_ROY_BODY");
  return {
    id: e.id,
    serialNo: e.serialNo,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    labSample: e.labSample
      ? { ...e.labSample, sampleDate: e.labSample.sampleDate.toISOString().slice(0, 10) }
      : null,
    company: e.company,
    sampleDesignName: e.sampleDesignName,
    numberOfBodies: e.numberOfBodies,
    designCategory: e.designCategory,
    designPatterns: e.designPatterns.map((p) => p.pattern),
    measurements: e.measurements.map((m) => ({ bodyIndex: m.bodyIndex, l: dec(m.l), a: dec(m.a), b: dec(m.b) })),
    royBody: roy ? toFormulationDTO(roy) : null,
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
  d.designPatterns.forEach((p) => ids.add(p.id));
  for (const c of [...(d.royBody?.components ?? []), ...(d.royBody?.veinRoyBody?.components ?? [])]) {
    if (c.material) ids.add(c.material.id);
    if (c.size) ids.add(c.size.id);
  }
  if (d.royBody?.mixerType) ids.add(d.royBody.mixerType.id);
  d.royBody?.veinMethods.forEach((m) => ids.add(m.id));
  return [...ids];
}

export function inwardToFormInput(d: InwardDetail): InwardFormInput {
  const n = d.numberOfBodies ?? 0;
  const s = (v: string | null) => (v === null ? "" : String(Number(v)));
  return {
    entryDate: d.entryDate,
    serialNo: String(d.serialNo),
    labSampleId: d.labSample?.id ?? null,
    company: d.company ? { id: d.company.id, label: d.company.label } : null,
    sampleDesignName: d.sampleDesignName ?? "",
    numberOfBodies: d.numberOfBodies === null ? "" : String(d.numberOfBodies),
    measurements: Array.from({ length: n }, (_, i) => {
      const m = d.measurements.find((x) => x.bodyIndex === i + 1);
      return m ? { l: s(m.l), a: s(m.a), b: s(m.b) } : emptyLabRow();
    }),
    designCategory: d.designCategory ?? "",
    designPatterns: d.designPatterns.map((p) => ({ id: p.id, label: p.label })),
    designRoyBody: royBodyToInput(d.royBody),
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
      sampleDesignName: true,
      designCategory: true,
      recreationAttempts: true,
      company: { select: { label: true } },
      labSample: { select: { serialNo: true } },
      designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    serialNo: r.serialNo,
    entryDate: r.entryDate.toISOString().slice(0, 10),
    labSampleSerial: r.labSample?.serialNo ?? null,
    company: r.company?.label ?? null,
    sampleDesignName: r.sampleDesignName,
    design:
      r.designCategory === "PLAIN_BODY"
        ? "Plain Body"
        : r.designPatterns.length
          ? r.designPatterns.map((p) => p.pattern.label).join(", ")
          : r.designCategory === "NON_PLAIN_BODY"
            ? "Non-Plain Body"
            : "",
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

/** Inspired lab samples whose physical sample is not present. */
export async function getRectification(): Promise<RectificationRow[]> {
  const rows = await prisma.labSample.findMany({
    where: { physicalSamplePresent: false, sampleType: { code: VALUE_CODE.INSPIRED_SAMPLE } },
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
      sampleType: { select: { code: true } },
      inwardEntry: { select: { id: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    serialNo: s.serialNo,
    slabNumber: s.slabNumber,
    sampleDate: s.sampleDate.toISOString().slice(0, 10),
    isInspired: s.sampleType?.code === VALUE_CODE.INSPIRED_SAMPLE,
    existingEntryId: s.inwardEntry?.id ?? null,
  };
}

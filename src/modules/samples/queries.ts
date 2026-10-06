import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sampleInclude } from "./service";
import { emptyFormulation, emptyLabRow, emptyRoyBody, type FormulationInput, type RoyBodyInput, type SampleFormInput } from "./schema";
import type { MasterRef } from "@/modules/master-data/types";

// ── DTOs (plain JSON — safe to pass to client components) ────────────────────

export interface ValueDTO {
  id: string;
  label: string;
  code: string | null;
  isActive: boolean;
}

export interface ComponentDTO {
  kind: "RESIN" | "GRIT" | "FILLER" | "PIGMENT";
  material: ValueDTO | null;
  size: ValueDTO | null;
  unit: "GRAMS" | "PERCENT" | null;
  quantity: string | null;
}

export interface FormulationDTO {
  role: "MAIN_BODY" | "DESIGN_ROY_BODY" | "VEIN_ROY_BODY";
  components: ComponentDTO[];
  /** Roy Body (from Design) details — empty / null for plain formulations. */
  numberOfBodies: number | null;
  hasVein: boolean | null;
  veinNotes: string | null;
  mixerType: ValueDTO | null;
  veinMethods: ValueDTO[];
  measurements: MeasurementDTO[];
  /** The Roy Body opened from this Roy Body's own Vein. */
  veinRoyBody: { components: ComponentDTO[] } | null;
}

export interface MeasurementDTO {
  stage: "POST_PRESS" | "POST_POLISH";
  bodyIndex: number;
  l: string | null;
  a: string | null;
  b: string | null;
}

export interface AttachmentDTO {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SampleDetail {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  status: "DRAFT" | "SUBMITTED";
  sampleType: ValueDTO | null;
  designName: string | null;
  physicalSamplePresent: boolean | null;
  /** The Inward / Outward entry recorded for this (Inspired) sample, if any. */
  inwardEntry: { id: string; serialNo: number } | null;
  numberOfBodies: number | null;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  mixerType: ValueDTO | null;
  hasVein: boolean | null;
  veinMethods: ValueDTO[];
  veinNotes: string | null;
  remarks: string | null;
  formulations: FormulationDTO[];
  measurements: MeasurementDTO[];
  attachments: AttachmentDTO[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type SampleWithAll = Prisma.LabSampleGetPayload<{ include: typeof sampleInclude }>;

export const dec = (d: Prisma.Decimal | null) => (d === null ? null : d.toString());

type FormulationWithComponents = SampleWithAll["formulations"][number];

const toComponentDTO = (c: FormulationWithComponents["components"][number]): ComponentDTO => ({
  kind: c.kind,
  material: c.material,
  size: c.size,
  unit: c.unit,
  quantity: dec(c.quantity),
});

export function toFormulationDTO(f: FormulationWithComponents): FormulationDTO {
  const nested = f.children.find((c) => c.role === "VEIN_ROY_BODY");
  return {
    role: f.role,
    components: f.components.map(toComponentDTO),
    numberOfBodies: f.numberOfBodies,
    hasVein: f.hasVein,
    veinNotes: f.veinNotes,
    mixerType: f.mixerType,
    veinMethods: f.veinMethods.map((m) => m.method),
    measurements: f.measurements.map((m) => ({ stage: m.stage, bodyIndex: m.bodyIndex, l: dec(m.l), a: dec(m.a), b: dec(m.b) })),
    veinRoyBody: nested ? { components: nested.components.map(toComponentDTO) } : null,
  };
}

export function toDetail(s: SampleWithAll): SampleDetail {
  return {
    id: s.id,
    serialNo: s.serialNo,
    slabNumber: s.slabNumber,
    sampleDate: s.sampleDate.toISOString().slice(0, 10),
    status: s.status,
    sampleType: s.sampleType,
    designName: s.designName,
    physicalSamplePresent: s.physicalSamplePresent,
    inwardEntry: s.inwardEntry,
    numberOfBodies: s.numberOfBodies,
    designCategory: s.designCategory,
    designPatterns: s.designPatterns.map((p) => p.pattern),
    mixerType: s.mixerType,
    hasVein: s.hasVein,
    veinMethods: s.veinMethods.map((m) => m.method),
    veinNotes: s.veinNotes,
    remarks: s.remarks,
    formulations: s.formulations.map(toFormulationDTO),
    measurements: s.measurements.map((m) => ({
      stage: m.stage,
      bodyIndex: m.bodyIndex,
      l: dec(m.l),
      a: dec(m.a),
      b: dec(m.b),
    })),
    attachments: s.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
    createdBy: s.createdBy?.name ?? null,
    updatedBy: s.updatedBy?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getSampleDetail(id: string): Promise<SampleDetail | null> {
  const s = await prisma.labSample.findUnique({ where: { id }, include: sampleInclude });
  return s ? toDetail(s) : null;
}

/** Every master-value id a sample points at (so disabled ones still show when editing). */
export function referencedValueIds(d: SampleDetail): string[] {
  const ids = new Set<string>();
  const add = (v: ValueDTO | null) => v && ids.add(v.id);
  add(d.sampleType);
  add(d.mixerType);
  d.designPatterns.forEach(add);
  d.veinMethods.forEach(add);
  d.formulations.forEach((f) => {
    f.components.forEach((c) => (add(c.material), add(c.size)));
    f.veinRoyBody?.components.forEach((c) => (add(c.material), add(c.size)));
    add(f.mixerType);
    f.veinMethods.forEach(add);
  });
  return [...ids];
}

// ── form prefill ─────────────────────────────────────────────────────────────

const ref = (v: ValueDTO | null): MasterRef | null => (v ? { id: v.id, label: v.label } : null);

export function formulationToInput(f: Pick<FormulationDTO, "components"> | null | undefined): FormulationInput {
  if (!f) return emptyFormulation();
  const rows = (kind: ComponentDTO["kind"]) =>
    f.components
      .filter((c) => c.kind === kind)
      .map((c) => ({
        material: ref(c.material),
        size: ref(c.size),
        unit: (c.unit ?? "") as "" | "GRAMS" | "PERCENT",
        quantity: c.quantity ? String(Number(c.quantity)) : "",
      }));
  const base = emptyFormulation();
  const resins = rows("RESIN");
  const grits = rows("GRIT");
  const fillers = rows("FILLER");
  return {
    resins: resins.length ? resins : base.resins,
    grits: grits.length ? grits : base.grits,
    fillers: fillers.length ? fillers : base.fillers,
    pigments: rows("PIGMENT"),
  };
}

const labInput = (ms: MeasurementDTO[], n: number, stage: MeasurementDTO["stage"]) =>
  Array.from({ length: n }, (_, i) => {
    const m = ms.find((x) => x.stage === stage && x.bodyIndex === i + 1);
    const s = (v: string | null) => (v === null ? "" : String(Number(v)));
    return m ? { l: s(m.l), a: s(m.a), b: s(m.b) } : emptyLabRow();
  });

/** A saved Roy Body back into its form shape. */
export function royBodyToInput(f: FormulationDTO | null | undefined): RoyBodyInput {
  if (!f) return emptyRoyBody();
  const n = f.numberOfBodies ?? 0;
  return {
    ...formulationToInput(f),
    numberOfBodies: f.numberOfBodies === null ? "" : String(f.numberOfBodies),
    hasVein: f.hasVein === null ? "" : f.hasVein ? "YES" : "NO",
    mixerType: ref(f.mixerType),
    veinMethods: f.veinMethods.map((m) => ({ id: m.id, label: m.label })),
    veinNotes: f.veinNotes ?? "",
    veinRoyBody: formulationToInput(f.veinRoyBody),
    postPress: labInput(f.measurements, n, "POST_PRESS"),
    postPolish: labInput(f.measurements, n, "POST_POLISH"),
  };
}

export function toFormInput(d: SampleDetail): SampleFormInput {
  const n = d.numberOfBodies ?? 0;
  const lab = (stage: MeasurementDTO["stage"]) =>
    Array.from({ length: n }, (_, i) => {
      const m = d.measurements.find((x) => x.stage === stage && x.bodyIndex === i + 1);
      const s = (v: string | null) => (v === null ? "" : String(Number(v)));
      return m ? { l: s(m.l), a: s(m.a), b: s(m.b) } : emptyLabRow();
    });
  return {
    serialNo: String(d.serialNo),
    slabNumber: d.slabNumber === null ? "" : String(d.slabNumber),
    sampleDate: d.sampleDate,
    sampleType: ref(d.sampleType),
    designName: d.designName ?? "",
    physicalSamplePresent: d.physicalSamplePresent === null ? "" : d.physicalSamplePresent ? "YES" : "NO",
    numberOfBodies: d.numberOfBodies === null ? "" : String(d.numberOfBodies),
    main: formulationToInput(d.formulations.find((f) => f.role === "MAIN_BODY")),
    designCategory: d.designCategory ?? "",
    designPatterns: d.designPatterns.map((p) => ({ id: p.id, label: p.label })),
    designRoyBody: royBodyToInput(d.formulations.find((f) => f.role === "DESIGN_ROY_BODY")),
    mixerType: ref(d.mixerType),
    hasVein: d.hasVein === null ? "" : d.hasVein ? "YES" : "NO",
    veinMethods: d.veinMethods.map((m) => ({ id: m.id, label: m.label })),
    veinNotes: d.veinNotes ?? "",
    veinRoyBody: formulationToInput(d.formulations.find((f) => f.role === "VEIN_ROY_BODY")),
    postPress: lab("POST_PRESS"),
    postPolish: lab("POST_POLISH"),
    attachmentIds: d.attachments.map((a) => a.id),
    remarks: d.remarks ?? "",
  };
}

// ── recent entries register ──────────────────────────────────────────────────

export interface RecentRow {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  status: "DRAFT" | "SUBMITTED";
  sampleType: string | null;
  design: string;
  mixerType: string | null;
  vein: string;
}

export async function getRecentSamples(take = 10): Promise<RecentRow[]> {
  const rows = await prisma.labSample.findMany({
    take,
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    select: {
      id: true,
      serialNo: true,
      slabNumber: true,
      sampleDate: true,
      status: true,
      designCategory: true,
      sampleType: { select: { label: true } },
      mixerType: { select: { label: true } },
      designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
      veinMethods: { select: { method: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    serialNo: r.serialNo,
    slabNumber: r.slabNumber,
    sampleDate: r.sampleDate.toISOString().slice(0, 10),
    status: r.status,
    sampleType: r.sampleType?.label ?? null,
    design:
      r.designCategory === "PLAIN_BODY"
        ? "Plain Body"
        : r.designPatterns.length
          ? r.designPatterns.map((p) => p.pattern.label).join(", ")
          : r.designCategory === "NON_PLAIN_BODY"
            ? "Non-Plain Body"
            : "",
    mixerType: r.mixerType?.label ?? null,
    vein: r.veinMethods.map((m) => m.method.label).join(", "),
  }));
}

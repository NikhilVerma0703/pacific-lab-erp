import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sampleInclude } from "./service";
import {
  emptyFormulation,
  emptyLabRow,
  emptyRoyBody,
  type FormulationInput,
  type LabRowInput,
  type RoyBodyInput,
  type SampleBodyInput,
  type SampleFormInput,
} from "./schema";
import { bodiesDesignText, bodyDesignsOrLegacy, unionLabels } from "./bodies";
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

/** L, a, b of one body at one stage. */
export interface LabValueDTO {
  l: string | null;
  a: string | null;
  b: string | null;
}

/** Body i of a lab sample: Material Choices, Design (+ Roy Body), Vein (+ Roy Body), L/a/b. */
export interface SampleBodyDTO {
  index: number;
  main: FormulationDTO | null;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  designRoyBody: FormulationDTO | null;
  mixerType: ValueDTO | null;
  hasVein: boolean | null;
  veinMethods: ValueDTO[];
  veinNotes: string | null;
  veinRoyBody: FormulationDTO | null;
  postPress: LabValueDTO | null;
  postPolish: LabValueDTO | null;
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
  /** Body 1 … n. */
  bodies: SampleBodyDTO[];
  /** Saved before body-wise entry: one design / vein / material for the whole sample, shown on every body. */
  legacyBodies: boolean;
  remarks: string | null;
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

const labValue = (m: SampleWithAll["measurements"][number] | undefined): LabValueDTO | null =>
  m ? { l: dec(m.l), a: dec(m.a), b: dec(m.b) } : null;

/**
 * Body 1 … n. A sample saved before body-wise entry has no body rows: its
 * one Material / Design / Vein is copied onto every body (Number of Bodies,
 * or 1 when that is blank), while each body keeps its own L/a/b readings.
 */
function toBodies(s: SampleWithAll): { bodies: SampleBodyDTO[]; legacy: boolean } {
  const f = (role: FormulationDTO["role"], i: number) => {
    const x = s.formulations.find((y) => y.role === role && y.bodyIndex === i);
    return x ? toFormulationDTO(x) : null;
  };
  const lab = (stage: "POST_PRESS" | "POST_POLISH", i: number) =>
    labValue(s.measurements.find((m) => m.stage === stage && m.bodyIndex === i));

  if (s.bodies.length) {
    const n = Math.max(s.numberOfBodies ?? 0, ...s.bodies.map((b) => b.bodyIndex));
    const bodies = Array.from({ length: n }, (_, k): SampleBodyDTO => {
      const i = k + 1;
      const b = s.bodies.find((x) => x.bodyIndex === i);
      return {
        index: i,
        main: f("MAIN_BODY", i),
        designCategory: b?.designCategory ?? null,
        designPatterns: b?.designPatterns.map((p) => p.pattern) ?? [],
        designRoyBody: f("DESIGN_ROY_BODY", i),
        mixerType: b?.mixerType ?? null,
        hasVein: b?.hasVein ?? null,
        veinMethods: b?.veinMethods.map((m) => m.method) ?? [],
        veinNotes: b?.veinNotes ?? null,
        veinRoyBody: f("VEIN_ROY_BODY", i),
        postPress: lab("POST_PRESS", i),
        postPolish: lab("POST_POLISH", i),
      };
    });
    return { bodies, legacy: false };
  }

  const hasLegacy =
    s.designCategory !== null ||
    s.designPatterns.length > 0 ||
    s.mixerType !== null ||
    s.hasVein !== null ||
    s.veinMethods.length > 0 ||
    !!s.veinNotes ||
    s.formulations.length > 0;
  const maxLab = Math.max(0, ...s.measurements.map((m) => m.bodyIndex));
  const n = s.numberOfBodies ?? (hasLegacy || maxLab ? Math.max(1, maxLab) : 0);
  const bodies = Array.from({ length: n }, (_, k): SampleBodyDTO => ({
    index: k + 1,
    main: f("MAIN_BODY", 1),
    designCategory: s.designCategory,
    designPatterns: s.designPatterns.map((p) => p.pattern),
    designRoyBody: f("DESIGN_ROY_BODY", 1),
    mixerType: s.mixerType,
    hasVein: s.hasVein,
    veinMethods: s.veinMethods.map((m) => m.method),
    veinNotes: s.veinNotes,
    veinRoyBody: f("VEIN_ROY_BODY", 1),
    postPress: lab("POST_PRESS", k + 1),
    postPolish: lab("POST_POLISH", k + 1),
  }));
  return { bodies, legacy: hasLegacy && n > 0 };
}

export function toDetail(s: SampleWithAll): SampleDetail {
  const { bodies, legacy } = toBodies(s);
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
    bodies,
    legacyBodies: legacy,
    remarks: s.remarks,
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
  const add = (v: ValueDTO | null | undefined) => v && ids.add(v.id);
  const addF = (f: FormulationDTO | null) => {
    if (!f) return;
    f.components.forEach((c) => (add(c.material), add(c.size)));
    f.veinRoyBody?.components.forEach((c) => (add(c.material), add(c.size)));
    add(f.mixerType);
    f.veinMethods.forEach(add);
  };
  add(d.sampleType);
  for (const b of d.bodies) {
    addF(b.main);
    addF(b.designRoyBody);
    addF(b.veinRoyBody);
    add(b.mixerType);
    b.designPatterns.forEach(add);
    b.veinMethods.forEach(add);
  }
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

const labRowInput = (v: LabValueDTO | null): LabRowInput => {
  const s = (x: string | null) => (x === null ? "" : String(Number(x)));
  return v ? { l: s(v.l), a: s(v.a), b: s(v.b) } : emptyLabRow();
};

export function bodyToInput(b: SampleBodyDTO): SampleBodyInput {
  return {
    main: formulationToInput(b.main),
    designCategory: b.designCategory ?? "",
    designPatterns: b.designPatterns.map((p) => ({ id: p.id, label: p.label })),
    designRoyBody: royBodyToInput(b.designRoyBody),
    mixerType: ref(b.mixerType),
    hasVein: b.hasVein === null ? "" : b.hasVein ? "YES" : "NO",
    veinMethods: b.veinMethods.map((m) => ({ id: m.id, label: m.label })),
    veinNotes: b.veinNotes ?? "",
    veinRoyBody: formulationToInput(b.veinRoyBody),
    postPress: labRowInput(b.postPress),
    postPolish: labRowInput(b.postPolish),
  };
}

export function toFormInput(d: SampleDetail): SampleFormInput {
  return {
    serialNo: String(d.serialNo),
    slabNumber: d.slabNumber === null ? "" : String(d.slabNumber),
    sampleDate: d.sampleDate,
    sampleType: ref(d.sampleType),
    designName: d.designName ?? "",
    physicalSamplePresent: d.physicalSamplePresent === null ? "" : d.physicalSamplePresent ? "YES" : "NO",
    // A pre-body sample with a blank n but recorded details opens with its one body.
    numberOfBodies: d.numberOfBodies !== null ? String(d.numberOfBodies) : d.bodies.length ? String(d.bodies.length) : "",
    bodies: d.bodies.map(bodyToInput),
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

const bodySelect = {
  orderBy: { bodyIndex: "asc" },
  select: {
    bodyIndex: true,
    designCategory: true,
    mixerType: { select: { label: true } },
    designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
    veinMethods: { select: { method: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
  },
} as const;

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
      numberOfBodies: true,
      designCategory: true,
      sampleType: { select: { label: true } },
      mixerType: { select: { label: true } },
      designPatterns: { select: { pattern: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
      veinMethods: { select: { method: { select: { label: true } } }, orderBy: { sortOrder: "asc" } },
      bodies: bodySelect,
    },
  });
  return rows.map((r) => {
    const designs = bodyDesignsOrLegacy(
      r.bodies.map((b) => ({ bodyIndex: b.bodyIndex, designCategory: b.designCategory, patterns: b.designPatterns.map((p) => p.pattern) })),
      { designCategory: r.designCategory, patterns: r.designPatterns.map((p) => p.pattern) },
      r.numberOfBodies,
    );
    const mixers = r.bodies.length ? r.bodies.map((b) => (b.mixerType ? [b.mixerType] : [])) : [r.mixerType ? [r.mixerType] : []];
    const veins = r.bodies.length ? r.bodies.map((b) => b.veinMethods.map((m) => m.method)) : [r.veinMethods.map((m) => m.method)];
    return {
      id: r.id,
      serialNo: r.serialNo,
      slabNumber: r.slabNumber,
      sampleDate: r.sampleDate.toISOString().slice(0, 10),
      status: r.status,
      sampleType: r.sampleType?.label ?? null,
      design: bodiesDesignText(designs),
      mixerType: unionLabels(mixers).join(", ") || null,
      vein: unionLabels(veins).join(", "),
    };
  });
}

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emptyVeinType, type VeinTypeInput } from "@/modules/forms/design";
import { designSummary, orderTypes, typeOfPattern, type DesignTypeKey } from "@/modules/forms/design-types";
import { emptyBodyReadings, type BodyReadingsInput } from "@/modules/forms/fields";
import { emptyGritRow, emptyMaterialRow, type MaterialsInput } from "@/modules/forms/materials";
import type { MasterRef } from "@/modules/master-data/types";
import { bodiesDesignText } from "./bodies";
import type { LabFormInput } from "./schema";
import { sampleInclude } from "./service";

/*
 * Lab samples — the read model: the Review page, the form (edit), Recent
 * Entries, and the Dashboard / Reports / Downloads (`SampleDetail`, which
 * keeps the shape it had and adds what the rebuilt form records).
 */

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
  role: "MAIN_BODY" | "DESIGN_ROY_BODY" | "VEIN_ROY_BODY" | "ROY_BODY" | "CHESSBOARD_BODY";
  components: ComponentDTO[];
  /** Additives Used (Additives list) with their Quantity (gm). */
  additives: { additive: ValueDTO; quantity: string | null }[];
  /** Roy Body (from Design) details — empty / null for plain formulations. */
  numberOfBodies: number | null;
  hasVein: boolean | null;
  /** Vein details (Vein Details list). */
  veinDetails: ValueDTO[];
  /** Vein details typed as free text before the Vein Details list existed. */
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
  /** Vein details (Vein Details list). */
  veinDetails: ValueDTO[];
  /** Vein details typed as free text before the Vein Details list existed. */
  veinNotes: string | null;
  veinRoyBody: FormulationDTO | null;
  postPress: LabValueDTO | null;
  postPolish: LabValueDTO | null;
}

/** One selected design type (Plain Body – No) and its fields. */
export interface DesignTypeDTO {
  type: DesignTypeKey;
  /** Roy Body / Chessboard: n. */
  bodyCount: number | null;
  /** Kreos / Vein: Vein Present. */
  veinPresent: boolean | null;
  mixerType: ValueDTO | null;
  veinDetails: ValueDTO[];
  colours: { colour: ValueDTO; quantity: string | null }[];
}

/** Roy Body k / Chessboard Body k of the rebuilt form: its Material Details and L, a, b. */
export interface SpecialBodyDTO {
  index: number;
  materials: FormulationDTO | null;
  postPress: LabValueDTO | null;
  postPolish: LabValueDTO | null;
}

export interface SampleDetail {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  status: "DRAFT" | "SUBMITTED";
  /** Design Name as shown (the list value, or a name typed before the list existed). */
  designName: string | null;
  /** The Design Names list value (null for a name typed before the list existed). */
  designNameRef: ValueDTO | null;
  /** Physical Sample Available? */
  physicalSamplePresent: boolean | null;
  /** The Inward / Outward entry recorded for this sample, if any. */
  inwardEntry: { id: string; serialNo: number } | null;
  numberOfBodies: number | null;
  /**
   * Plain Body – Yes (true) / No (false); null when not answered. For samples
   * of the earlier form: No when any body was Non-Plain, Yes when all were Plain.
   */
  plainBody: boolean | null;
  /**
   * Plain Body – No: the design types with their fields. For samples of the
   * earlier form: the design patterns that are design types (fields empty).
   */
  designTypes: DesignTypeDTO[];
  /** Earlier form: design patterns that are not design types (kept on save). */
  otherPatterns: ValueDTO[];
  /** Body 1 … n. */
  bodies: SampleBodyDTO[];
  /** Roy Body 1 … n / Chessboard Body 1 … n of the rebuilt form. */
  royBodies: SpecialBodyDTO[];
  chessboardBodies: SpecialBodyDTO[];
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
    additives: f.additives.map((a) => ({ additive: a.additive, quantity: dec(a.quantity) })),
    numberOfBodies: f.numberOfBodies,
    hasVein: f.hasVein,
    veinDetails: f.veinDetails.map((d) => d.detail),
    veinNotes: f.legacyVeinNotes,
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
    labValue(s.measurements.find((m) => m.part === "MAIN" && m.stage === stage && m.bodyIndex === i));

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
        veinDetails: b?.veinDetails.map((d) => d.detail) ?? [],
        veinNotes: b?.legacyVeinNotes ?? null,
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
  const maxLab = Math.max(0, ...s.measurements.filter((m) => m.part === "MAIN").map((m) => m.bodyIndex));
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
    veinDetails: [],
    veinNotes: s.veinNotes,
    veinRoyBody: f("VEIN_ROY_BODY", 1),
    postPress: lab("POST_PRESS", k + 1),
    postPolish: lab("POST_POLISH", k + 1),
  }));
  return { bodies, legacy: hasLegacy && n > 0 };
}

/** The design types with their fields, in the form's order. */
export function toDesignTypes(
  details: {
    type: DesignTypeKey;
    bodyCount: number | null;
    veinPresent: boolean | null;
    mixerType: ValueDTO | null;
    veinDetails: { detail: ValueDTO }[];
    colours: { colour: ValueDTO; quantity: Prisma.Decimal | null }[];
  }[],
): DesignTypeDTO[] {
  const order = orderTypes(details.map((d) => d.type));
  return order.map((k) => {
    const d = details.find((x) => x.type === k)!;
    return {
      type: d.type,
      bodyCount: d.bodyCount,
      veinPresent: d.veinPresent,
      mixerType: d.mixerType,
      veinDetails: d.veinDetails.map((v) => v.detail),
      colours: d.colours.map((c) => ({ colour: c.colour, quantity: dec(c.quantity) })),
    };
  });
}

const blankType = (type: DesignTypeKey): DesignTypeDTO => ({ type, bodyCount: null, veinPresent: null, mixerType: null, veinDetails: [], colours: [] });

/** Plain Body and the design types — as recorded by the rebuilt form, else read from the earlier form's design. */
function designOf(s: SampleWithAll, bodies: SampleBodyDTO[]) {
  const patterns = [...s.designPatterns.map((p) => p.pattern), ...bodies.flatMap((b) => b.designPatterns)];
  const seen = new Set<string>();
  const otherPatterns = patterns.filter((p) => !typeOfPattern(p) && !seen.has(p.id) && seen.add(p.id));
  let plainBody: boolean | null;
  if (s.designCategory !== null) plainBody = s.designCategory === "PLAIN_BODY";
  else {
    const cats = bodies.map((b) => b.designCategory).filter(Boolean);
    plainBody = cats.includes("NON_PLAIN_BODY") ? false : cats.length ? true : null;
  }
  const recorded = toDesignTypes(s.designDetails);
  const designTypes =
    recorded.length || plainBody !== false
      ? recorded
      : orderTypes(patterns.map((p) => typeOfPattern(p)).filter((k): k is DesignTypeKey => !!k)).map(blankType);
  return { plainBody, designTypes, otherPatterns: plainBody === false ? otherPatterns : [] };
}

/** Roy Body 1 … n / Chessboard Body 1 … n: Material Details and L, a, b. */
function specialBodies(s: SampleWithAll, role: "ROY_BODY" | "CHESSBOARD_BODY", part: "ROY_BODY" | "CHESSBOARD", count: number | null | undefined): SpecialBodyDTO[] {
  const fs = s.formulations.filter((f) => f.role === role);
  const ms = s.measurements.filter((m) => m.part === part);
  const n = Math.max(count ?? 0, ...fs.map((f) => f.bodyIndex), ...ms.map((m) => m.bodyIndex));
  return Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    const f = fs.find((x) => x.bodyIndex === i);
    return {
      index: i,
      materials: f ? toFormulationDTO(f) : null,
      postPress: labValue(ms.find((m) => m.stage === "POST_PRESS" && m.bodyIndex === i)),
      postPolish: labValue(ms.find((m) => m.stage === "POST_POLISH" && m.bodyIndex === i)),
    };
  });
}

export function toDetail(s: SampleWithAll): SampleDetail {
  const { bodies, legacy } = toBodies(s);
  const design = designOf(s, bodies);
  const count = (t: DesignTypeKey) => design.designTypes.find((x) => x.type === t)?.bodyCount;
  return {
    id: s.id,
    serialNo: s.serialNo,
    slabNumber: s.slabNumber,
    sampleDate: s.sampleDate.toISOString().slice(0, 10),
    status: s.status,
    designName: s.designNameValue?.label ?? s.legacyDesignName,
    designNameRef: s.designNameValue,
    physicalSamplePresent: s.physicalSamplePresent,
    inwardEntry: s.inwardEntry,
    numberOfBodies: s.numberOfBodies,
    plainBody: design.plainBody,
    designTypes: design.designTypes,
    otherPatterns: design.otherPatterns,
    bodies,
    royBodies: design.designTypes.some((t) => t.type === "ROY_BODY") ? specialBodies(s, "ROY_BODY", "ROY_BODY", count("ROY_BODY")) : [],
    chessboardBodies: design.designTypes.some((t) => t.type === "CHESSBOARD") ? specialBodies(s, "CHESSBOARD_BODY", "CHESSBOARD", count("CHESSBOARD")) : [],
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
export function sampleValueIds(d: SampleDetail): string[] {
  const ids = new Set<string>();
  if (d.designNameRef) ids.add(d.designNameRef.id);
  const formulation = (f: FormulationDTO | null) => {
    if (!f) return;
    for (const c of f.components) {
      if (c.material) ids.add(c.material.id);
      if (c.size) ids.add(c.size.id);
    }
    f.additives.forEach((a) => ids.add(a.additive.id));
  };
  d.bodies.forEach((b) => formulation(b.main));
  [...d.royBodies, ...d.chessboardBodies].forEach((b) => formulation(b.materials));
  for (const t of d.designTypes) {
    if (t.mixerType) ids.add(t.mixerType.id);
    t.veinDetails.forEach((v) => ids.add(v.id));
    t.colours.forEach((c) => ids.add(c.colour.id));
  }
  return [...ids];
}

// ── form prefill ─────────────────────────────────────────────────────────────

const str = (v: string | null) => (v === null ? "" : String(Number(v)));
const ref = (v: ValueDTO): MasterRef => ({ id: v.id, label: v.label });
const yesNo = (v: boolean | null) => (v === null ? "" : v ? "YES" : "NO") as "" | "YES" | "NO";
const unitOf = (c: ComponentDTO) => (c.unit === "PERCENT" ? ("PERCENT" as const) : c.unit === "GRAMS" ? ("GRAMS" as const) : ("" as const));
const readingInput = (v: LabValueDTO | null) => (v ? { l: str(v.l), a: str(v.a), b: str(v.b) } : { l: "", a: "", b: "" });
const bodyReadings = (pp: LabValueDTO | null, pl: LabValueDTO | null): BodyReadingsInput =>
  pp || pl ? { postPress: readingInput(pp), postPolish: readingInput(pl) } : emptyBodyReadings();

/** A formulation back into Material Details (one empty Resin / Grits / Filler row when none). */
export function materialsInput(f: Pick<FormulationDTO, "components" | "additives"> | null): MaterialsInput {
  const of = (k: ComponentDTO["kind"]) => (f?.components ?? []).filter((c) => c.kind === k);
  const rows = (k: "RESIN" | "FILLER") => {
    const list = of(k).map((c) => ({ material: c.material ? ref(c.material) : null, quantity: str(c.quantity), unit: unitOf(c) }));
    return list.length ? list : [emptyMaterialRow()];
  };
  const grits = of("GRIT").map((c) => ({
    material: c.material ? ref(c.material) : null,
    size: c.size ? ref(c.size) : null,
    quantity: str(c.quantity),
    unit: unitOf(c),
  }));
  return {
    resins: rows("RESIN"),
    grits: grits.length ? grits : [emptyGritRow()],
    fillers: rows("FILLER"),
    pigments: of("PIGMENT")
      .filter((c) => c.material)
      .map((c) => ({ colour: ref(c.material!), quantity: str(c.quantity), unit: unitOf(c) })),
    additives: (f?.additives ?? []).map((a) => ({ colour: ref(a.additive), quantity: str(a.quantity) })),
  };
}

/** A saved sample back into the form. Samples of the earlier form open with what maps onto this form. */
export function toLabFormInput(d: SampleDetail): LabFormInput {
  const t = (k: DesignTypeKey) => d.designTypes.find((x) => x.type === k);
  const vein = (k: "KREOS" | "VEIN"): VeinTypeInput => {
    const x = t(k);
    if (!x) return emptyVeinType();
    return {
      veinPresent: yesNo(x.veinPresent),
      mixerType: x.mixerType ? ref(x.mixerType) : null,
      veinDetails: x.veinDetails.map(ref),
      colours: x.colours.map((c) => ({ colour: ref(c.colour), quantity: str(c.quantity) })),
    };
  };
  const count = (k: DesignTypeKey, list: SpecialBodyDTO[]) => {
    const c = t(k)?.bodyCount ?? (list.length || null);
    return c === null ? "" : String(c);
  };
  const plainBody = yesNo(d.plainBody);
  return {
    sampleDate: d.sampleDate,
    serialNo: String(d.serialNo),
    slabNumber: d.slabNumber === null ? "" : String(d.slabNumber),
    // A name typed before the Design Names list existed opens as a new (Other…) name.
    designName: d.designNameRef ? ref(d.designNameRef) : d.designName ? { label: d.designName } : null,
    plainBody,
    designTypes: plainBody === "NO" ? d.designTypes.map((x) => x.type) : [],
    numberOfBodies: d.numberOfBodies !== null ? String(d.numberOfBodies) : d.bodies.length ? String(d.bodies.length) : "",
    // Saved before body-wise entry: its one set of materials goes to Body 1 (it is shown on every
    // body, but was used once — saving it on every body would multiply it in Reports).
    materials: d.bodies.map((b, i) => materialsInput(d.legacyBodies && i > 0 ? null : b.main)),
    royBody: { count: count("ROY_BODY", d.royBodies), materials: d.royBodies.map((b) => materialsInput(b.materials)) },
    kreos: vein("KREOS"),
    carrara: { colours: (t("CARRARA")?.colours ?? []).map((c) => ({ colour: ref(c.colour), quantity: str(c.quantity) })) },
    vein: vein("VEIN"),
    chessboard: { count: count("CHESSBOARD", d.chessboardBodies), materials: d.chessboardBodies.map((b) => materialsInput(b.materials)) },
    readings: d.bodies.map((b) => bodyReadings(b.postPress, b.postPolish)),
    royReadings: d.royBodies.map((b) => bodyReadings(b.postPress, b.postPolish)),
    chessboardReadings: d.chessboardBodies.map((b) => bodyReadings(b.postPress, b.postPolish)),
    attachmentIds: d.attachments.map((a) => a.id),
    remarks: d.remarks ?? "",
  };
}

/** "Plain Body" · "Roy Body, Carrara" — or, for the earlier form, the design per body. */
export function sampleDesignText(d: SampleDetail): string {
  const recorded = d.plainBody === true || d.designTypes.some((t) => t.bodyCount !== null || t.veinPresent !== null || t.colours.length > 0);
  if (recorded || !d.bodies.length) return designSummary(d.plainBody, d.designTypes.map((t) => t.type));
  return bodiesDesignText(d.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns })));
}

// ── Recent Entries ───────────────────────────────────────────────────────────

export interface RecentRow {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  status: "DRAFT" | "SUBMITTED";
  designName: string | null;
  design: string;
  numberOfBodies: number | null;
  remarks: string | null;
  files: number;
}

export const RECENT_PAGE_SIZE = 20;

/** Saved samples, newest first, one page at a time. */
export async function getRecentSamples(page = 1): Promise<{ rows: RecentRow[]; total: number; page: number; pages: number }> {
  const total = await prisma.labSample.count();
  const pages = Math.max(1, Math.ceil(total / RECENT_PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const list = await prisma.labSample.findMany({
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    skip: (p - 1) * RECENT_PAGE_SIZE,
    take: RECENT_PAGE_SIZE,
    include: sampleInclude,
  });
  const rows = list.map((s): RecentRow => {
    const d = toDetail(s);
    return {
      id: d.id,
      serialNo: d.serialNo,
      slabNumber: d.slabNumber,
      sampleDate: d.sampleDate,
      status: d.status,
      designName: d.designName,
      design: sampleDesignText(d),
      numberOfBodies: d.numberOfBodies,
      remarks: d.remarks,
      files: d.attachments.length,
    };
  });
  return { rows, total, page: p, pages };
}

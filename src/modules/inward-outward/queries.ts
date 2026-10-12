import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeKey } from "@/lib/normalize";
import { emptyLabReading, type LabReadingInput } from "@/modules/forms/fields";
import type { MasterRef } from "@/modules/master-data/types";
import {
  dec,
  toFormulationDTO,
  type AttachmentDTO,
  type FormulationDTO,
  type LabValueDTO,
  type ValueDTO,
} from "@/modules/samples/queries";
import { inwardDesignText } from "./design-text";
import { DESIGN_TYPES, orderTypes, type DesignTypeKey } from "@/modules/forms/design-types";
import { emptyVeinType, type InwardFormInput } from "./schema";
import { inwardInclude } from "./service";

/*
 * Inward / Outward — reading entries back. `InwardDetail` is also what
 * Downloads exports, so it keeps the shape it had (per-body design, Roy Body
 * formulation, readings) and adds what the rebuilt form records.
 */

// ── DTOs (plain JSON — safe to pass to client components) ────────────────────

/** Body i of an entry: its design (the whole sample's, or per body for the earlier form) and its L, a, b. */
export interface InwardBodyDTO {
  index: number;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  /** Earlier form only: the Roy Body formulation opened from this body's design. */
  royBody: FormulationDTO | null;
  lab: LabValueDTO | null;
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

export interface InwardDetail {
  id: string;
  serialNo: number;
  entryDate: string;
  slabNumber: number | null;
  /** Earlier form only: the lab sample this physical sample was recorded for. */
  labSample: { id: string; serialNo: number; slabNumber: number | null; sampleDate: string } | null;
  company: ValueDTO | null;
  /** Design Name as shown (the list value, or a name typed before the list existed). */
  sampleDesignName: string | null;
  /** The Design Names list value (null for a name typed before the list existed). */
  sampleDesignNameRef: ValueDTO | null;
  /** Plain Body – Yes (true) / No (false); null when not answered. */
  plainBody: boolean | null;
  /** Plain Body – No: the selected design types, in the form's order. */
  designTypes: DesignTypeDTO[];
  numberOfBodies: number | null;
  /** Body 1 … N. */
  bodies: InwardBodyDTO[];
  /** Roy Body 1 … n / Chessboard Body 1 … n readings. */
  royBodies: LabValueDTO[];
  chessboardBodies: LabValueDTO[];
  /** Saved by the earlier form with a design per body. */
  legacyBodies: boolean;
  /** Earlier form only. */
  recreationAttempts: string | null;
  attachments: AttachmentDTO[];
  remarks: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type EntryWithAll = Prisma.InwardOutwardEntryGetPayload<{ include: typeof inwardInclude }>;

const reading = (m: { l: Prisma.Decimal | null; a: Prisma.Decimal | null; b: Prisma.Decimal | null } | undefined): LabValueDTO | null =>
  m ? { l: dec(m.l), a: dec(m.a), b: dec(m.b) } : null;

function inwardBodies(e: EntryWithAll): { bodies: InwardBodyDTO[]; legacy: boolean } {
  const roy = (i: number) => {
    const f = e.formulations.find((x) => x.role === "DESIGN_ROY_BODY" && x.bodyIndex === i);
    return f ? toFormulationDTO(f) : null;
  };
  const lab = (i: number) => reading(e.measurements.find((x) => x.part === "MAIN" && x.bodyIndex === i));
  if (e.bodies.length) {
    // Earlier form: a design per body.
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
    return { bodies, legacy: true };
  }
  // The design of the whole sample, on every body.
  const hasDesign = e.designCategory !== null || e.designPatterns.length > 0 || e.formulations.length > 0;
  const maxLab = Math.max(0, ...e.measurements.filter((m) => m.part === "MAIN").map((m) => m.bodyIndex));
  const n = e.numberOfBodies ?? (hasDesign || maxLab ? Math.max(1, maxLab) : 0);
  const bodies = Array.from({ length: n }, (_, k): InwardBodyDTO => ({
    index: k + 1,
    designCategory: e.designCategory,
    designPatterns: e.designPatterns.map((p) => p.pattern),
    royBody: roy(1),
    lab: lab(k + 1),
  }));
  return { bodies, legacy: false };
}

function designTypesOf(e: EntryWithAll): DesignTypeDTO[] {
  const order = DESIGN_TYPES.map((t) => t.key as string);
  return [...e.designDetails]
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((d) => ({
      type: d.type,
      bodyCount: d.bodyCount,
      veinPresent: d.veinPresent,
      mixerType: d.mixerType,
      veinDetails: d.veinDetails.map((v) => v.detail),
      colours: d.colours.map((c) => ({ colour: c.colour, quantity: dec(c.quantity) })),
    }));
}

const readingsOf = (e: EntryWithAll, part: "ROY_BODY" | "CHESSBOARD", count: number | null | undefined) => {
  const list = e.measurements.filter((m) => m.part === part);
  const n = Math.max(count ?? 0, ...list.map((m) => m.bodyIndex));
  return Array.from({ length: n }, (_, k) => reading(list.find((m) => m.bodyIndex === k + 1)) ?? { l: null, a: null, b: null });
};

export function toInwardDetail(e: EntryWithAll): InwardDetail {
  const { bodies, legacy } = inwardBodies(e);
  const types = designTypesOf(e);
  const count = (t: DesignTypeKey) => types.find((x) => x.type === t)?.bodyCount;
  return {
    id: e.id,
    serialNo: e.serialNo,
    entryDate: e.entryDate.toISOString().slice(0, 10),
    slabNumber: e.slabNumber,
    labSample: e.labSample ? { ...e.labSample, sampleDate: e.labSample.sampleDate.toISOString().slice(0, 10) } : null,
    company: e.company,
    sampleDesignName: e.designNameValue?.label ?? e.legacySampleDesignName,
    sampleDesignNameRef: e.designNameValue,
    plainBody: e.designCategory === null ? null : e.designCategory === "PLAIN_BODY",
    designTypes: types,
    numberOfBodies: e.numberOfBodies,
    bodies,
    royBodies: readingsOf(e, "ROY_BODY", count("ROY_BODY")),
    chessboardBodies: readingsOf(e, "CHESSBOARD", count("CHESSBOARD")),
    legacyBodies: legacy,
    recreationAttempts: e.recreationAttempts,
    attachments: e.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
    remarks: e.remarks,
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

/** Master values the entry points at (so disabled ones still show when editing). */
export function inwardValueIds(d: InwardDetail): string[] {
  const ids = new Set<string>();
  if (d.company) ids.add(d.company.id);
  if (d.sampleDesignNameRef) ids.add(d.sampleDesignNameRef.id);
  for (const t of d.designTypes) {
    if (t.mixerType) ids.add(t.mixerType.id);
    t.veinDetails.forEach((v) => ids.add(v.id));
    t.colours.forEach((c) => ids.add(c.colour.id));
  }
  return [...ids];
}

// ── form prefill ─────────────────────────────────────────────────────────────

const str = (v: string | null) => (v === null ? "" : String(Number(v)));
const readingInput = (v: LabValueDTO | null): LabReadingInput => (v ? { l: str(v.l), a: str(v.a), b: str(v.b) } : emptyLabReading());
const ref = (v: ValueDTO): MasterRef => ({ id: v.id, label: v.label });
const yesNo = (v: boolean | null) => (v === null ? "" : v ? "YES" : "NO") as "" | "YES" | "NO";

/** A saved entry back into the form. Entries from the earlier form open with the design they recorded. */
export function toInwardFormInput(d: InwardDetail): InwardFormInput {
  // Design types: those recorded by this form, else the earlier form's patterns that are design types.
  let types = d.designTypes.map((t) => t.type);
  if (!types.length) {
    const patterns = d.bodies.flatMap((b) => b.designPatterns);
    types = orderTypes(
      DESIGN_TYPES.filter((t) => patterns.some((p) => p.code === t.code || normalizeKey(p.label) === normalizeKey(t.patternLabel))).map((t) => t.key),
    );
  }
  let plainBody = yesNo(d.plainBody);
  if (d.legacyBodies) {
    const cats = d.bodies.map((b) => b.designCategory).filter(Boolean);
    plainBody = cats.includes("NON_PLAIN_BODY") ? "NO" : cats.length ? "YES" : "";
  }
  const t = (k: DesignTypeKey) => d.designTypes.find((x) => x.type === k);
  const vein = (k: "KREOS" | "VEIN") => {
    const x = t(k);
    if (!x) return emptyVeinType();
    return {
      veinPresent: yesNo(x.veinPresent),
      mixerType: x.mixerType ? ref(x.mixerType) : null,
      veinDetails: x.veinDetails.map(ref),
      colours: x.colours.map((c) => ({ colour: ref(c.colour), quantity: str(c.quantity) })),
    };
  };
  const count = (k: DesignTypeKey) => (t(k)?.bodyCount == null ? "" : String(t(k)!.bodyCount));
  return {
    entryDate: d.entryDate,
    serialNo: String(d.serialNo),
    slabNumber: d.slabNumber === null ? "" : String(d.slabNumber),
    company: d.company ? ref(d.company) : null,
    // A name typed before the Design Names list existed opens as a new (Other…) name.
    designName: d.sampleDesignNameRef ? ref(d.sampleDesignNameRef) : d.sampleDesignName ? { label: d.sampleDesignName } : null,
    plainBody,
    designTypes: plainBody === "NO" ? types : [],
    numberOfBodies: d.numberOfBodies !== null ? String(d.numberOfBodies) : d.bodies.length ? String(d.bodies.length) : "",
    royBody: { count: count("ROY_BODY") },
    kreos: vein("KREOS"),
    carrara: { colours: (t("CARRARA")?.colours ?? []).map((c) => ({ colour: ref(c.colour), quantity: str(c.quantity) })) },
    vein: vein("VEIN"),
    chessboard: { count: count("CHESSBOARD") },
    bodies: d.bodies.map((b) => readingInput(b.lab)),
    royBodies: d.royBodies.map(readingInput),
    chessboardBodies: d.chessboardBodies.map(readingInput),
    attachmentIds: d.attachments.map((a) => a.id),
    remarks: d.remarks ?? "",
  };
}

// ── the register ─────────────────────────────────────────────────────────────

export interface InwardRegisterRow {
  id: string;
  serialNo: number;
  entryDate: string;
  slabNumber: number | null;
  company: string | null;
  designName: string | null;
  design: string;
  numberOfBodies: number | null;
  /** Earlier form only. */
  labSampleSerial: number | null;
  remarks: string | null;
  files: number;
}

export const REGISTER_PAGE_SIZE = 20;

/** Saved entries, newest first, one page at a time. */
export async function getInwardRegister(page = 1): Promise<{ rows: InwardRegisterRow[]; total: number; page: number; pages: number }> {
  const total = await prisma.inwardOutwardEntry.count();
  const pages = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const list = await prisma.inwardOutwardEntry.findMany({
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    skip: (p - 1) * REGISTER_PAGE_SIZE,
    take: REGISTER_PAGE_SIZE,
    include: inwardInclude,
  });
  const rows = list.map((e): InwardRegisterRow => {
    const d = toInwardDetail(e);
    return {
      id: d.id,
      serialNo: d.serialNo,
      entryDate: d.entryDate,
      slabNumber: d.slabNumber,
      company: d.company?.label ?? null,
      designName: d.sampleDesignName,
      design: inwardDesignText(d),
      numberOfBodies: d.numberOfBodies,
      labSampleSerial: d.labSample?.serialNo ?? null,
      // The earlier form had Lab Recreation Attempts instead of Remarks.
      remarks: d.remarks ?? d.recreationAttempts,
      files: d.attachments.length,
    };
  });
  return { rows, total, page: p, pages };
}

// ── Rectification ────────────────────────────────────────────────────────────

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


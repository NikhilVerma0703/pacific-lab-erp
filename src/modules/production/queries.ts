import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { MasterRef } from "@/modules/master-data/types";
import { bodiesDesignText } from "@/modules/samples/bodies";
import { dec, type AttachmentDTO, type LabValueDTO, type ValueDTO } from "@/modules/samples/queries";
import { emptyLabRow } from "@/modules/samples/schema";
import { productionInclude } from "./service";
import type { ProductionFormInput } from "./schema";

// ── DTOs (plain JSON — safe to pass to client components) ────────────────────

export type Stage = "POST_PRESS" | "POST_POLISH";

export interface ReadingDTO {
  stage: Stage;
  bodyIndex: number;
  l: string | null;
  a: string | null;
  b: string | null;
}

/** Body i of a production sample: its Design (+ Roy Body: n and L/a/b) and its own L/a/b. */
export interface ProductionBodyDTO {
  index: number;
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  designPatterns: ValueDTO[];
  /** Present when ROY BODY is one of this body's design patterns. */
  royBody: { numberOfBodies: number | null; readings: ReadingDTO[] } | null;
  postPress: LabValueDTO | null;
  postPolish: LabValueDTO | null;
}

export interface ProductionDetail {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  designName: string | null;
  numberOfBodies: number | null;
  /** Body 1 … n. */
  bodies: ProductionBodyDTO[];
  /** Saved before body-wise entry: one design for the whole entry, shown on every body. */
  legacyBodies: boolean;
  attachments: AttachmentDTO[];
  remarks: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type WithAll = Prisma.ProductionSampleGetPayload<{ include: typeof productionInclude }>;
type Measurement = WithAll["measurements"][number];

const toReading = (m: Measurement): ReadingDTO => ({
  stage: m.stage,
  bodyIndex: m.bodyIndex,
  l: dec(m.l),
  a: dec(m.a),
  b: dec(m.b),
});

function productionBodies(s: WithAll): { bodies: ProductionBodyDTO[]; legacy: boolean } {
  const main = (stage: Stage, i: number): LabValueDTO | null => {
    const m = s.measurements.find((x) => x.part === "MAIN" && x.stage === stage && x.bodyIndex === i);
    return m ? { l: dec(m.l), a: dec(m.a), b: dec(m.b) } : null;
  };
  const royReadings = (owner: number) => s.measurements.filter((m) => m.part === "ROY_BODY" && m.ownerBody === owner).map(toReading);
  const isRoy = (patterns: { code: string | null }[]) => patterns.some((p) => p.code === "ROY_BODY");

  if (s.bodies.length) {
    const n = Math.max(s.numberOfBodies ?? 0, ...s.bodies.map((b) => b.bodyIndex));
    const bodies = Array.from({ length: n }, (_, k): ProductionBodyDTO => {
      const i = k + 1;
      const b = s.bodies.find((x) => x.bodyIndex === i);
      const patterns = b?.designPatterns.map((p) => p.pattern) ?? [];
      return {
        index: i,
        designCategory: b?.designCategory ?? null,
        designPatterns: patterns,
        royBody: isRoy(patterns) ? { numberOfBodies: b?.royNumberOfBodies ?? null, readings: royReadings(i) } : null,
        postPress: main("POST_PRESS", i),
        postPolish: main("POST_POLISH", i),
      };
    });
    return { bodies, legacy: false };
  }

  // Saved before body-wise entry: its one design (and Roy Body) on every body.
  const patterns = s.designPatterns.map((p) => p.pattern);
  const hasLegacy = s.designCategory !== null || patterns.length > 0;
  const maxLab = Math.max(0, ...s.measurements.filter((m) => m.part === "MAIN").map((m) => m.bodyIndex));
  const n = s.numberOfBodies ?? (hasLegacy || maxLab ? Math.max(1, maxLab) : 0);
  const bodies = Array.from({ length: n }, (_, k): ProductionBodyDTO => ({
    index: k + 1,
    designCategory: s.designCategory,
    designPatterns: patterns,
    royBody: isRoy(patterns) ? { numberOfBodies: s.royNumberOfBodies, readings: royReadings(0) } : null,
    postPress: main("POST_PRESS", k + 1),
    postPolish: main("POST_POLISH", k + 1),
  }));
  return { bodies, legacy: hasLegacy && n > 0 };
}

export function toProductionDetail(s: WithAll): ProductionDetail {
  const { bodies, legacy } = productionBodies(s);
  return {
    id: s.id,
    serialNo: s.serialNo,
    slabNumber: s.slabNumber,
    sampleDate: s.sampleDate.toISOString().slice(0, 10),
    designName: s.designName,
    numberOfBodies: s.numberOfBodies,
    bodies,
    legacyBodies: legacy,
    attachments: s.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
    remarks: s.remarks,
    createdBy: s.createdBy?.name ?? null,
    updatedBy: s.updatedBy?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getProductionDetail(id: string): Promise<ProductionDetail | null> {
  const s = await prisma.productionSample.findUnique({ where: { id }, include: productionInclude });
  return s ? toProductionDetail(s) : null;
}

/** Master values the entry points at (so disabled ones still show when editing). */
export const productionValueIds = (d: ProductionDetail) => [...new Set(d.bodies.flatMap((b) => b.designPatterns.map((p) => p.id)))];

// ── form prefill ─────────────────────────────────────────────────────────────

const str = (v: string | null) => (v === null ? "" : String(Number(v)));
const rowInput = (v: LabValueDTO | null) => (v ? { l: str(v.l), a: str(v.a), b: str(v.b) } : emptyLabRow());

const labInput = (readings: ReadingDTO[], n: number, stage: Stage) =>
  Array.from({ length: n }, (_, i) => {
    const m = readings.find((x) => x.stage === stage && x.bodyIndex === i + 1);
    return m ? { l: str(m.l), a: str(m.a), b: str(m.b) } : emptyLabRow();
  });

export function toProductionFormInput(d: ProductionDetail): ProductionFormInput {
  const ref = (v: ValueDTO): MasterRef => ({ id: v.id, label: v.label });
  return {
    sampleDate: d.sampleDate,
    serialNo: String(d.serialNo),
    slabNumber: d.slabNumber === null ? "" : String(d.slabNumber),
    designName: d.designName ?? "",
    numberOfBodies: d.numberOfBodies !== null ? String(d.numberOfBodies) : d.bodies.length ? String(d.bodies.length) : "",
    bodies: d.bodies.map((b) => {
      const rn = b.royBody?.numberOfBodies ?? 0;
      return {
        designCategory: b.designCategory ?? "",
        designPatterns: b.designPatterns.map(ref),
        designRoyBody: {
          numberOfBodies: b.royBody?.numberOfBodies == null ? "" : String(b.royBody.numberOfBodies),
          postPress: labInput(b.royBody?.readings ?? [], rn, "POST_PRESS"),
          postPolish: labInput(b.royBody?.readings ?? [], rn, "POST_POLISH"),
        },
        postPress: rowInput(b.postPress),
        postPolish: rowInput(b.postPolish),
      };
    }),
    attachmentIds: d.attachments.map((a) => a.id),
    remarks: d.remarks ?? "",
  };
}

// ── the register ─────────────────────────────────────────────────────────────

export interface RegisterRow {
  id: string;
  serialNo: number;
  slabNumber: number | null;
  sampleDate: string;
  designName: string | null;
  numberOfBodies: number | null;
  design: string;
  bodies: ProductionBodyDTO[];
  files: number;
  remarks: string | null;
}

export const REGISTER_PAGE_SIZE = 20;

/** Saved production samples, newest first, one page at a time. */
export async function getProductionRegister(page = 1): Promise<{ rows: RegisterRow[]; total: number; page: number; pages: number }> {
  const total = await prisma.productionSample.count();
  const pages = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const list = await prisma.productionSample.findMany({
    orderBy: [{ createdAt: "desc" }, { serialNo: "desc" }],
    skip: (p - 1) * REGISTER_PAGE_SIZE,
    take: REGISTER_PAGE_SIZE,
    include: productionInclude,
  });
  const rows = list.map((r): RegisterRow => {
    const d = toProductionDetail(r);
    return {
      id: d.id,
      serialNo: d.serialNo,
      slabNumber: d.slabNumber,
      sampleDate: d.sampleDate,
      designName: d.designName,
      numberOfBodies: d.numberOfBodies,
      design: bodiesDesignText(d.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns }))),
      bodies: d.bodies,
      files: d.attachments.length,
      remarks: d.remarks,
    };
  });
  return { rows, total, page: p, pages };
}

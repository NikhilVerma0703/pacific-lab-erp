import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeKey } from "@/lib/normalize";
import { periodWhere, type Period } from "@/modules/downloads/period";
import { designSummary, designTypeTags, orderTypes, type DesignTypeKey } from "@/modules/forms/design-types";
import { TOLERANCE } from "./search";

/*
 * Slab Records — finding a slab that was made before, across all three forms.
 *
 *  - by L, a, b: every saved reading, Post Polish where the form has stages
 *    (Post Press only when that body has no Post Polish), within ±0.5 of each
 *    value, nearest first;
 *  - by Production Date, Slab Number and / or Design Name.
 *
 * Both read the saved records themselves, so a slab stays findable for as
 * long as its record exists.
 */

export { TOLERANCE } from "./search";

export type SlabSource = "LAB" | "INWARD" | "PRODUCTION";

export const SOURCE_LABEL: Record<SlabSource, string> = {
  LAB: "Lab Sample",
  INWARD: "Inward / Outward Sample",
  PRODUCTION: "Production Sample",
};

const REVIEW_PATH: Record<SlabSource, string> = { LAB: "/samples", INWARD: "/inward-outward", PRODUCTION: "/production-sample" };
export const reviewHref = (source: SlabSource, id: string) => `${REVIEW_PATH[source]}/${id}`;

export interface SlabRow {
  source: SlabSource;
  id: string;
  date: string;
  serialNo: number;
  slabNumber: number | null;
  designName: string | null;
  designType: string;
  numberOfBodies: number | null;
}

export interface SlabMatch extends SlabRow {
  /** "Body 2", "Roy Body 1", "Chessboard Body 3" — the reading that matched. */
  body: string;
  /** "Post Polish" / "Post Press", or "" where the form records one reading. */
  stage: string;
  l: number;
  a: number;
  b: number;
  /** How far the reading is from the one searched for (L + a + b). */
  difference: number;
}

// ── design types of the matching records ─────────────────────────────────────

const bodyPart = (part: string, index: number) =>
  part === "ROY_BODY" ? `Roy Body ${index}` : part === "CHESSBOARD" ? `Chessboard Body ${index}` : `Body ${index}`;

/** Plain Body / the design types of each record, from the forms' own tables. */
async function designTypesOf(ids: Record<SlabSource, string[]>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const [lab, inward, production] = await Promise.all([
    ids.LAB.length
      ? prisma.labSampleRecord.findMany({ where: { sampleId: { in: ids.LAB } }, select: { sampleId: true, plainBody: true, designTypes: true } })
      : [],
    ids.INWARD.length
      ? prisma.inwardOutwardRecord.findMany({ where: { entryId: { in: ids.INWARD } }, select: { entryId: true, plainBody: true, designTypes: true } })
      : [],
    ids.PRODUCTION.length
      ? prisma.productionSample.findMany({
          where: { id: { in: ids.PRODUCTION } },
          select: {
            id: true,
            designCategory: true,
            designPatterns: { select: { pattern: { select: { label: true, code: true } } } },
            bodies: { select: { designCategory: true, designPatterns: { select: { pattern: { select: { label: true, code: true } } } } } },
          },
        })
      : [],
  ]);
  for (const r of lab) out.set(`LAB:${r.sampleId}`, designSummary(r.plainBody, orderTypes(r.designTypes) as DesignTypeKey[]));
  for (const r of inward) out.set(`INWARD:${r.entryId}`, designSummary(r.plainBody, orderTypes(r.designTypes) as DesignTypeKey[]));
  for (const p of production) {
    // Production samples carry a design only when the earlier form recorded one.
    const bodies = p.bodies.length
      ? p.bodies.map((b) => ({ designCategory: b.designCategory, designPatterns: b.designPatterns.map((x) => x.pattern) }))
      : [{ designCategory: p.designCategory, designPatterns: p.designPatterns.map((x) => x.pattern) }];
    out.set(`PRODUCTION:${p.id}`, designTypeTags({ plainBody: null, types: [], bodies }).join(", "));
  }
  return out;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Group the ids of a result set by form, for one lookup per form. */
function idsBySource(rows: { source: SlabSource; id: string }[]): Record<SlabSource, string[]> {
  const ids: Record<SlabSource, string[]> = { LAB: [], INWARD: [], PRODUCTION: [] };
  for (const r of rows) if (!ids[r.source].includes(r.id)) ids[r.source].push(r.id);
  return ids;
}

// ── A · by L, a, b ───────────────────────────────────────────────────────────

interface RawMatch {
  src: SlabSource;
  rid: string;
  sno: number;
  d: Date;
  slab: number | null;
  dname: string | null;
  bodies: number | null;
  part: string;
  bidx: number;
  stage: string | null;
  l: number;
  a: number;
  b: number;
  diff: number;
}

/**
 * Slabs whose reading is within ±`TOLERANCE` of each of L, a and b, nearest
 * first. One row per matching body: a sample can match on more than one.
 */
export async function searchByMeasurement(target: { l: number; a: number; b: number }, limit = 200): Promise<SlabMatch[]> {
  const { l, a, b } = target;
  const t = TOLERANCE;
  const rows = await prisma.$queryRaw<RawMatch[]>(Prisma.sql`
    WITH readings AS (
      SELECT 'LAB' AS src, s.id AS rid, s."serialNo" AS sno, s."sampleDate" AS d, s."slabNumber" AS slab,
             COALESCE(v.label, s."designName") AS dname, s."numberOfBodies" AS bodies,
             m.part::text AS part, m."bodyIndex" AS bidx, m.stage::text AS stage,
             CASE WHEN m.stage = 'POST_POLISH' THEN 1 ELSE 2 END AS pref,
             m.l::float8 AS l, m.a::float8 AS a, m.b::float8 AS b
      FROM "LabMeasurement" m
      JOIN "LabSample" s ON s.id = m."sampleId"
      LEFT JOIN "MasterValue" v ON v.id = s."designNameId"
      WHERE m.l IS NOT NULL AND m.a IS NOT NULL AND m.b IS NOT NULL
      UNION ALL
      SELECT 'INWARD', e.id, e."serialNo", e."entryDate", e."slabNumber",
             COALESCE(v.label, e."sampleDesignName"), e."numberOfBodies",
             m.part::text, m."bodyIndex", NULL, 1,
             m.l::float8, m.a::float8, m.b::float8
      FROM "InwardMeasurement" m
      JOIN "InwardOutwardEntry" e ON e.id = m."entryId"
      LEFT JOIN "MasterValue" v ON v.id = e."designNameId"
      WHERE m.l IS NOT NULL AND m.a IS NOT NULL AND m.b IS NOT NULL
      UNION ALL
      SELECT 'PRODUCTION', p.id, p."serialNo", p."sampleDate", p."slabNumber",
             COALESCE(v.label, p."designName"), p."numberOfBodies",
             m.part::text, m."bodyIndex", m.stage::text,
             CASE WHEN m.stage = 'POST_POLISH' THEN 1 ELSE 2 END,
             m.l::float8, m.a::float8, m.b::float8
      FROM "ProductionMeasurement" m
      JOIN "ProductionSample" p ON p.id = m."productionSampleId"
      LEFT JOIN "MasterValue" v ON v.id = p."designNameId"
      WHERE m.l IS NOT NULL AND m.a IS NOT NULL AND m.b IS NOT NULL
    ),
    -- Post Polish where there is one; otherwise that body's Post Press.
    best AS (
      SELECT DISTINCT ON (src, rid, part, bidx) *
      FROM readings
      ORDER BY src, rid, part, bidx, pref
    )
    SELECT src, rid, sno, d, slab, dname, bodies, part, bidx, stage, l, a, b,
           ABS(l - ${l}) + ABS(a - ${a}) + ABS(b - ${b}) AS diff
    FROM best
    WHERE ABS(l - ${l}) <= ${t} AND ABS(a - ${a}) <= ${t} AND ABS(b - ${b}) <= ${t}
    ORDER BY diff ASC, d DESC, slab DESC NULLS LAST
    LIMIT ${limit}`);

  const types = await designTypesOf(idsBySource(rows.map((r) => ({ source: r.src, id: r.rid }))));
  return rows.map((r) => ({
    source: r.src,
    id: r.rid,
    date: iso(r.d),
    serialNo: r.sno,
    slabNumber: r.slab,
    designName: r.dname,
    designType: types.get(`${r.src}:${r.rid}`) ?? "",
    numberOfBodies: r.bodies,
    body: bodyPart(r.part, r.bidx),
    stage: r.stage === "POST_POLISH" ? "Post Polish" : r.stage === "POST_PRESS" ? "Post Press" : "",
    l: r.l,
    a: r.a,
    b: r.b,
    difference: Number(r.diff),
  }));
}

// ── B · by Production Date / Slab Number / Design Name ───────────────────────

export interface ParameterFilters {
  /** null = any date. */
  period: Period | null;
  /** null = any slab. */
  slabNumber: number | null;
  /** "" = any design. */
  designName: string;
}

export const hasAnyFilter = (f: ParameterFilters) => !!f.period || f.slabNumber !== null || !!f.designName;

/** Records of any of the three forms matching every filter given, newest first. */
export async function searchByParameter(f: ParameterFilters, limit = 300): Promise<SlabRow[]> {
  const key = normalizeKey(f.designName);
  const common = (dateField: string, legacyName: string) => ({
    ...(f.period ? { [dateField]: periodWhere(f.period) } : {}),
    ...(f.slabNumber !== null ? { slabNumber: f.slabNumber } : {}),
    ...(key ? { OR: [{ designNameValue: { normalizedKey: key } }, { [legacyName]: { equals: f.designName, mode: "insensitive" as const } }] } : {}),
  });

  const [lab, inward, production] = await Promise.all([
    prisma.labSample.findMany({
      where: common("sampleDate", "legacyDesignName"),
      select: { id: true, serialNo: true, sampleDate: true, slabNumber: true, numberOfBodies: true, designNameValue: { select: { label: true } }, legacyDesignName: true },
      orderBy: [{ sampleDate: "desc" }, { serialNo: "desc" }],
      take: limit,
    }),
    prisma.inwardOutwardEntry.findMany({
      where: common("entryDate", "legacySampleDesignName"),
      select: {
        id: true,
        serialNo: true,
        entryDate: true,
        slabNumber: true,
        numberOfBodies: true,
        designNameValue: { select: { label: true } },
        legacySampleDesignName: true,
      },
      orderBy: [{ entryDate: "desc" }, { serialNo: "desc" }],
      take: limit,
    }),
    prisma.productionSample.findMany({
      where: common("sampleDate", "legacyDesignName"),
      select: { id: true, serialNo: true, sampleDate: true, slabNumber: true, numberOfBodies: true, designNameValue: { select: { label: true } }, legacyDesignName: true },
      orderBy: [{ sampleDate: "desc" }, { serialNo: "desc" }],
      take: limit,
    }),
  ]);

  const rows: Omit<SlabRow, "designType">[] = [
    ...lab.map((r) => ({
      source: "LAB" as const,
      id: r.id,
      date: iso(r.sampleDate),
      serialNo: r.serialNo,
      slabNumber: r.slabNumber,
      designName: r.designNameValue?.label ?? r.legacyDesignName,
      numberOfBodies: r.numberOfBodies,
    })),
    ...inward.map((r) => ({
      source: "INWARD" as const,
      id: r.id,
      date: iso(r.entryDate),
      serialNo: r.serialNo,
      slabNumber: r.slabNumber,
      designName: r.designNameValue?.label ?? r.legacySampleDesignName,
      numberOfBodies: r.numberOfBodies,
    })),
    ...production.map((r) => ({
      source: "PRODUCTION" as const,
      id: r.id,
      date: iso(r.sampleDate),
      serialNo: r.serialNo,
      slabNumber: r.slabNumber,
      designName: r.designNameValue?.label ?? r.legacyDesignName,
      numberOfBodies: r.numberOfBodies,
    })),
  ];
  rows.sort((x, y) => y.date.localeCompare(x.date) || (y.slabNumber ?? 0) - (x.slabNumber ?? 0) || y.serialNo - x.serialNo);

  const types = await designTypesOf(idsBySource(rows));
  return rows.slice(0, limit).map((r) => ({ ...r, designType: types.get(`${r.source}:${r.id}`) ?? "" }));
}

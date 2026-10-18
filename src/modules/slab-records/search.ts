/**
 * Slab Records — reading both searches out of the URL and back into it, so
 * the page, the form and a saved link always agree. Pure (no database), so
 * the browser and the server share it.
 */
import { cleanLabel } from "@/lib/normalize";
import { parsePeriod, periodQuery, type Period } from "@/modules/downloads/period";

/** How far a saved reading may sit from the one searched for and still match. */
export const TOLERANCE = 0.5;

export type Query = Record<string, string | string[] | undefined>;
const one = (q: Query, k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? "";

/** A number typed into a search box; blank or nonsense → null. */
export function readNumber(raw: string, opts: { min?: number; max?: number; int?: boolean } = {}): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (opts.int && !Number.isInteger(n)) return null;
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}

// ── A · L, a, b ──────────────────────────────────────────────────────────────

export interface MeasurementSearch {
  /** What was typed, kept as typed so the form shows it back. */
  raw: { l: string; a: string; b: string };
  /** All three readable and in range → the search runs. */
  values: { l: number; a: number; b: number } | null;
  /** What to tell the person when it cannot run, or null. */
  problem: string | null;
}

/** L is 0–100, a and b −128…128 — the same limits the forms accept. */
export function parseMeasurementSearch(q: Query): MeasurementSearch {
  const raw = { l: one(q, "l").trim(), a: one(q, "a").trim(), b: one(q, "b").trim() };
  const l = readNumber(raw.l, { min: 0, max: 100 });
  const a = readNumber(raw.a, { min: -128, max: 128 });
  const b = readNumber(raw.b, { min: -128, max: 128 });
  const asked = !!(raw.l || raw.a || raw.b);
  if (l !== null && a !== null && b !== null) return { raw, values: { l, a, b }, problem: null };
  return {
    raw,
    values: null,
    problem: !asked ? null : "Enter all three values — L (0–100), a and b (−128 … 128).",
  };
}

export const measurementQuery = (v: { l: string; a: string; b: string }) => ({ find: "lab", l: v.l, a: v.a, b: v.b });

// ── B · any parameter ────────────────────────────────────────────────────────

export interface ParameterSearch {
  /** null = any date (the Production Date dropdown's "Any date"). */
  period: Period | null;
  rawSlab: string;
  slabNumber: number | null;
  designName: string;
  problem: string | null;
}

/** `period` missing or "any" searches every date, including future-dated records. */
export function parseParameterSearch(q: Query, today: string): ParameterSearch {
  const mode = one(q, "period");
  const period = mode === "all" || mode === "date" || mode === "range" ? parsePeriod(q, today) : null;
  const rawSlab = one(q, "slab").trim();
  const slabNumber = readNumber(rawSlab, { min: 1, int: true });
  const designName = cleanLabel(one(q, "design")).slice(0, 120);
  return {
    period,
    rawSlab,
    slabNumber,
    designName,
    problem: rawSlab && slabNumber === null ? "Slab Number must be a whole number." : null,
  };
}

export function parameterQuery(f: { period: Period | null; slab: string; design: string }): Record<string, string> {
  return {
    find: "any",
    ...(f.period ? periodQuery(f.period) : {}),
    ...(f.slab ? { slab: f.slab } : {}),
    ...(f.design ? { design: f.design } : {}),
  };
}

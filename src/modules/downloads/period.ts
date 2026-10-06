/**
 * "Production Date" — the period every Downloads subsection works on.
 * Pure (no database): shared by the forms, the page, the Excel route and the
 * unit tests, so the screen and the file always use the same records.
 *
 *   All         every record dated from the beginning up to today
 *   Date Wise   one date
 *   Date Range  From … To (both inclusive)
 *
 * The date compared is each record's own Date field.
 */
export type PeriodMode = "all" | "date" | "range";

export interface Period {
  mode: PeriodMode;
  /** Date Wise: the date. */
  date: string;
  /** Date Range: first and last day (inclusive). For All, `to` is today. */
  from: string;
  to: string;
}

export const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "date", label: "Date Wise" },
  { value: "range", label: "Date Range" },
];

export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The default: today, Date Wise. (A first Date Range is the 7 days up to today.) */
export const defaultPeriod = (today: string): Period => ({ mode: "date", date: today, from: shiftDays(today, -6), to: today });

/** YYYY-MM-DD moved by `n` days. */
export function shiftDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Read a period from a URL query (`period`, `date`, `from`, `to`). Invalid
 * dates fall back to today; a reversed range is put the right way round.
 * A bare `date=` (no `period`) is Date Wise, as before.
 */
export function parsePeriod(q: Record<string, string | string[] | undefined>, today: string): Period {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? "";
  const raw = one("period");
  const mode: PeriodMode = raw === "all" || raw === "range" ? raw : "date";
  if (mode === "all") return { mode, date: today, from: "", to: today };
  if (mode === "date") {
    const date = isIsoDate(one("date")) ? one("date") : today;
    return { mode, date, from: shiftDays(date, -6), to: date };
  }
  let from = isIsoDate(one("from")) ? one("from") : today;
  let to = isIsoDate(one("to")) ? one("to") : today;
  if (from > to) [from, to] = [to, from];
  return { mode, date: to, from, to };
}

/** Problem with a period being typed in a form (shown under the fields), or null. */
export function periodProblem(p: Period): string | null {
  if (p.mode === "date") return isIsoDate(p.date) ? null : "Choose a date.";
  if (p.mode === "range") {
    if (!isIsoDate(p.from) || !isIsoDate(p.to)) return "Choose both From and To dates.";
    if (p.from > p.to) return "From must be on or before To.";
  }
  return null;
}

export function periodQuery(p: Period): Record<string, string> {
  if (p.mode === "all") return { period: "all" };
  if (p.mode === "range") return { period: "range", from: p.from, to: p.to };
  return { period: "date", date: p.date };
}

/** Is a record dated `iso` (YYYY-MM-DD) inside the period? */
export function inPeriod(iso: string, p: Period): boolean {
  const d = iso.slice(0, 10);
  if (p.mode === "all") return !p.to || d <= p.to;
  if (p.mode === "date") return d === p.date;
  return d >= p.from && d <= p.to;
}

/** Prisma filter for a `@db.Date` column. */
export function periodWhere(p: Period): { gte?: Date; lte?: Date; equals?: Date } {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  if (p.mode === "all") return p.to ? { lte: day(p.to) } : {};
  if (p.mode === "date") return { equals: day(p.date) };
  return { gte: day(p.from), lte: day(p.to) };
}

const nice = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** "All dates (up to 06 Oct 2026)" · "06 Oct 2026" · "01 Oct 2026 – 06 Oct 2026" */
export function periodLabel(p: Period): string {
  if (p.mode === "all") return `All dates (up to ${nice(p.to)})`;
  if (p.mode === "date") return nice(p.date);
  return p.from === p.to ? nice(p.from) : `${nice(p.from)} – ${nice(p.to)}`;
}

/** "on this date" · "in this date range" · "in total, up to today" */
export function periodPhrase(p: Period): string {
  return p.mode === "all" ? "in total, up to today" : p.mode === "range" ? "in this date range" : "on this date";
}

/** File-name part: "2026-10-06" · "2026-10-01_to_2026-10-06" · "All_upto_2026-10-06" */
export function periodFileTag(p: Period): string {
  if (p.mode === "all") return `All_upto_${p.to}`;
  if (p.mode === "date") return p.date;
  return `${p.from}_to_${p.to}`;
}

/**
 * Plant-time helpers. The server may run in UTC (Neon / Vercel); "today" and
 * "this morning" must mean the plant's day (APP_TIMEZONE, default Asia/Kolkata).
 */
export const plantTimeZone = () => process.env.APP_TIMEZONE ?? "Asia/Kolkata";

/** YYYY-MM-DD in the plant's time zone. */
export function plantToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: plantTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "+05:30" — the plant's UTC offset on a given instant. */
function offsetOf(at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: plantTimeZone(), timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+00:00";
}

/** [start, end) instants of a plant calendar day, for createdAt filters. */
export function plantDayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00${offsetOf(new Date(`${day}T12:00:00Z`))}`);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}

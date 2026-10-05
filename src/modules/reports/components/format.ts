/** "05 Oct" — short date for axes. */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Grams → "1,250 g" or "12.4 kg". */
export function formatGrams(g: number): string {
  if (Math.abs(g) >= 10_000) return `${(g / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`;
  return `${g.toLocaleString("en-IN", { maximumFractionDigits: 2 })} g`;
}

/** Y domain: the requested 0–12, growing (in steps of 2) only if a day exceeds 12. */
export function countDomain(max: number): [number, number] {
  return [0, Math.max(12, Math.ceil(max / 2) * 2)];
}

export function countTicks(top: number): number[] {
  const step = top <= 12 ? 2 : Math.ceil(top / 6);
  const t: number[] = [];
  for (let v = 0; v <= top; v += step) t.push(v);
  return t;
}

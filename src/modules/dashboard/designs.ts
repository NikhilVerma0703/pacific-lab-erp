/**
 * "Designs worked on" = design patterns (Plain Body counts as one) plus the
 * named designs recorded in Inward / Outward ("Calacatta Gold …"), merged
 * case- and space-insensitively. Pure, so it is unit-tested.
 */
export interface DesignTally {
  name: string;
  count: number;
}

export function tallyDesigns(names: (string | null | undefined)[]): DesignTally[] {
  const byKey = new Map<string, DesignTally>();
  for (const raw of names) {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const t = byKey.get(key);
    if (t) t.count++;
    else byKey.set(key, { name, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The design names one record contributes. */
export function designsOf(r: {
  designCategory: "PLAIN_BODY" | "NON_PLAIN_BODY" | null;
  patterns: string[];
  designName?: string | null;
}): string[] {
  const out = r.designCategory === "PLAIN_BODY" ? ["Plain Body"] : r.designCategory === "NON_PLAIN_BODY" ? [...r.patterns] : [];
  if (r.designName) out.push(r.designName);
  return out;
}

/**
 * "Designs worked on" = design patterns (Plain Body counts as one) plus the
 * named designs recorded in Inward / Outward ("Calacatta Gold …"), merged
 * case- and space-insensitively. Pure, so it is unit-tested.
 */
import { compareLabels, normalizeKey } from "../../lib/normalize";

export interface DesignTally {
  name: string;
  count: number;
}

export function tallyDesigns(names: (string | null | undefined)[]): DesignTally[] {
  const byKey = new Map<string, DesignTally>();
  for (const raw of names) {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = normalizeKey(name);
    const t = byKey.get(key);
    if (t) t.count++;
    else byKey.set(key, { name, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || compareLabels(a.name, b.name));
}

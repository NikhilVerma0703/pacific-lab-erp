/**
 * Body-wise records — pure helpers shared by every section (lab samples,
 * Inward / Outward, Production Sample), the registers, Excel, Reports and the
 * Dashboard. No database access, so they are unit-tested.
 *
 * Every form records Body 1 … n separately. A record saved before that keeps
 * one design for the whole record; it is shown as that design on every body.
 */

export type DesignCategoryValue = "PLAIN_BODY" | "NON_PLAIN_BODY";

/** The design of one body, in the shape the summaries need. */
export interface BodyDesign {
  designCategory: DesignCategoryValue | null;
  patterns: { id?: string; label: string }[];
}

/** "Plain Body" · "CARRARA, ROY BODY" · "Non-Plain Body" · "" */
export function designText(d: BodyDesign): string {
  if (d.designCategory === "PLAIN_BODY") return "Plain Body";
  if (d.patterns.length) return d.patterns.map((p) => p.label).join(", ");
  return d.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : "";
}

/**
 * One line for a register cell: the design when every body shares it,
 * otherwise "Body 1: Plain Body · Body 2: ROY BODY".
 */
export function bodiesDesignText(bodies: BodyDesign[]): string {
  const texts = bodies.map(designText);
  const distinct = [...new Set(texts.filter(Boolean))];
  if (distinct.length <= 1 && texts.every((t) => t === texts[0])) return texts[0] ?? "";
  return texts.map((t, i) => (t ? `Body ${i + 1}: ${t}` : "")).filter(Boolean).join(" · ");
}

/** Every distinct label across bodies, in first-seen order. */
export function unionLabels(lists: { label: string }[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists)
    for (const v of list) {
      const k = v.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v.label);
      }
    }
  return out;
}

/** Distinct values by id (falls back to label), first-seen order. */
export function unionValues<T extends { id?: string; label: string }>(lists: T[][]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const list of lists)
    for (const v of list) {
      const k = v.id ?? v.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
  return out;
}

/** The categories used across bodies (Plain and/or Non-Plain), in that order. */
export function categoriesOf(bodies: BodyDesign[]): DesignCategoryValue[] {
  return (["PLAIN_BODY", "NON_PLAIN_BODY"] as const).filter((c) => bodies.some((b) => b.designCategory === c));
}

/**
 * The design names a record contributes to "designs worked on" / Design
 * Analysis: "Plain Body" if any body is plain, plus every pattern of every
 * body, each once per record.
 */
export function designNamesOf(bodies: BodyDesign[], noPatternLabel?: string): string[] {
  const out = new Set<string>();
  for (const b of bodies) {
    if (b.designCategory === "PLAIN_BODY") out.add("Plain Body");
    else if (b.patterns.length) b.patterns.forEach((p) => out.add(p.label));
    else if (b.designCategory === "NON_PLAIN_BODY" && noPatternLabel) out.add(noPatternLabel);
  }
  return [...out];
}

/**
 * Bodies to show for a record: its own body rows when it has any; otherwise
 * (saved before body-wise entry) `n` copies of its record-level design, where
 * n is its Number of Bodies — or 1 when that is blank but a design exists.
 */
export function bodyDesignsOrLegacy(
  bodies: (BodyDesign & { bodyIndex: number })[],
  legacy: BodyDesign,
  numberOfBodies: number | null,
): BodyDesign[] {
  if (bodies.length) return [...bodies].sort((a, b) => a.bodyIndex - b.bodyIndex);
  const hasLegacy = legacy.designCategory !== null || legacy.patterns.length > 0;
  const n = numberOfBodies ?? (hasLegacy ? 1 : 0);
  return Array.from({ length: n }, () => ({ designCategory: legacy.designCategory, patterns: legacy.patterns }));
}

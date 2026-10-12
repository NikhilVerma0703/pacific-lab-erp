/**
 * Text values are case-insensitive across the ERP.
 *
 * "  Glass ", "glass" and "GLASS" are the same value — for searching,
 * filtering, duplicate checks, picking and database matching (every master
 * value stores this key, unique per list). The label keeps the user's casing
 * (first one wins); the key is what is compared.
 */
export function cleanLabel(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeKey(raw: string): string {
  return cleanLabel(raw).toLowerCase();
}

/** Labels longer than this are almost certainly pasted notes, not list values. */
export const MAX_LABEL_LENGTH = 80;

/** The same text, ignoring case and spaces? */
export const sameText = (a: string | null | undefined, b: string | null | undefined) => normalizeKey(a ?? "") === normalizeKey(b ?? "");

/** Sort order for labels: case-insensitive ("apple" next to "Apple", before "Banana"). */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }) || a.localeCompare(b);
}

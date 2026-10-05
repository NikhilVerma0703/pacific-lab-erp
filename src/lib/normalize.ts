/**
 * Master-value normalisation.
 *
 * "  Glass ", "glass" and "GLASS" are the same value. The label keeps the
 * user's casing (first one wins); the key is what uniqueness is checked on.
 */
export function cleanLabel(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeKey(raw: string): string {
  return cleanLabel(raw).toLowerCase();
}

/** Labels longer than this are almost certainly pasted notes, not list values. */
export const MAX_LABEL_LENGTH = 80;

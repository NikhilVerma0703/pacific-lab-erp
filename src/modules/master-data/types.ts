import type { MasterCode } from "./catalog";

/** A selectable value as the browser sees it. */
export interface MasterOption {
  id: string;
  label: string;
  code: string | null;
  isActive: boolean;
}

/** Every list the form needs, keyed by category code. */
export type MasterOptions = Record<MasterCode, MasterOption[]>;

/**
 * A picked value inside a form.
 *  - `{ id, label }`            an existing master value
 *  - `{ label, save }` (no id)  typed via OTHER; `save` = add it to the list
 */
export interface MasterRef {
  id?: string;
  label: string;
  save?: boolean;
}

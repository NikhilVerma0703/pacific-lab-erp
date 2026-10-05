"use client";

import { createContext, useContext } from "react";
import type { MasterOptions } from "@/modules/master-data/types";

/** Lists + permissions every nested lab form component needs (sample form, inward form …). */
export interface SampleFormEnv {
  options: MasterOptions;
  allowCustom: boolean;
}

export const SampleFormContext = createContext<SampleFormEnv | null>(null);

export function useSampleFormEnv(): SampleFormEnv {
  const ctx = useContext(SampleFormContext);
  if (!ctx) throw new Error("useSampleFormEnv outside SampleFormContext");
  return ctx;
}

/** Read a nested error message from RHF's error tree by dotted path. */
export function errorAt(errors: unknown, path: string): string | undefined {
  let cur: unknown = errors;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  const msg = (cur as { message?: unknown } | undefined)?.message;
  return typeof msg === "string" ? msg : undefined;
}

/**
 * Does a picked value carry a behaviour code (e.g. ROY BODY)? Works for values
 * typed via OTHER too, by matching the coded value's label.
 */
export function hasCode(
  refs: ({ id?: string; label: string } | null | undefined)[],
  options: { id: string; label: string; code: string | null }[],
  code: string,
): boolean {
  const target = options.find((o) => o.code === code);
  const key = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return refs.some(
    (r) =>
      !!r &&
      ((r.id && options.find((o) => o.id === r.id)?.code === code) ||
        (!r.id && !!target && key(r.label) === key(target.label))),
  );
}

"use client";

import { useEffect } from "react";
import { useFormContext, useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { emptyLabRow, MAX_BODIES } from "@/modules/samples/schema";
import { errorAt } from "./form-context";

/** Clamp whatever is in "Number of Bodies" to 0…MAX_BODIES. */
export function bodyCount(raw: unknown): number {
  return Math.min(Math.max(Math.trunc(Number(raw)) || 0, 0), MAX_BODIES);
}

/**
 * Keep the L/a/b arrays at `paths` sized to Number of Bodies, preserving typed
 * values when n grows or shrinks. Takes the form object because it runs in the
 * component that creates the form, outside its FormProvider.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useBodyRows(form: UseFormReturn<any, any, any>, countPath: string, paths: string[]) {
  const { control, getValues, setValue } = form as UseFormReturn<FieldValues>;
  const raw = useWatch({ control, name: countPath });
  const key = paths.join("|");
  useEffect(() => {
    const n = bodyCount(raw);
    for (const p of key.split("|")) {
      const cur = (getValues(p) ?? []) as unknown[];
      if (cur.length === n) continue;
      setValue(p, Array.from({ length: n }, (_, i) => cur[i] ?? emptyLabRow()), { shouldDirty: false });
    }
  }, [raw, key, getValues, setValue]);
  return bodyCount(raw);
}

/** Body 1…n rows of L / a / b inputs for the array at `name`. */
export function LabRowsFields({
  name,
  n,
  title,
  dot = "brand",
}: {
  name: string;
  n: number;
  title?: string;
  dot?: "brand" | "accent";
}) {
  const { register, formState } = useFormContext<FieldValues>();
  const label = title ?? "L/a/b";
  return (
    <div>
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-brand uppercase">
          <span className={cn("size-2.5 rounded-full", dot === "brand" ? "bg-brand" : "bg-accent")} />
          {title}
        </h3>
      )}
      <div className="space-y-2">
        <div className="hidden grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-2 px-1 text-xs font-bold text-ink-3 sm:grid">
          <span />
          <span>L</span>
          <span>a</span>
          <span>b</span>
        </div>
        {Array.from({ length: n }, (_, i) => {
          const errs = (["l", "a", "b"] as const).map((k) => errorAt(formState.errors, `${name}.${i}.${k}`)).filter(Boolean);
          return (
            <div key={i}>
              <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[72px_repeat(3,minmax(0,1fr))]">
                <span className="text-[13px] font-semibold text-ink-2">Body {i + 1}</span>
                {(["l", "a", "b"] as const).map((k) => {
                  const err = errorAt(formState.errors, `${name}.${i}.${k}`);
                  return (
                    <input
                      key={k}
                      aria-label={`${label} Body ${i + 1} ${k === "l" ? "L" : k}`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={k === "l" ? "L" : k}
                      className={cn("input px-2 text-center", err && "input-error")}
                      {...register(`${name}.${i}.${k}`)}
                    />
                  );
                })}
              </div>
              {errs.length > 0 && <p className="mt-1 pl-[72px] text-[13px] text-bad-fg">{errs[0]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NoBodiesHint() {
  return (
    <p className="rounded-lg bg-info-bg px-4 py-3 text-sm text-info-fg">
      Enter <strong>Number of Bodies</strong> — one L / a / b row per body will appear here.
    </p>
  );
}

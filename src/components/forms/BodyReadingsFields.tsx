"use client";

import { useEffect } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { bodyCount, emptyBodyReadings } from "@/modules/forms/fields";
import { errorAt } from "./errors";

const STAGES = [
  { key: "postPress", title: "Post Press", dot: "bg-brand" },
  { key: "postPolish", title: "Post Polish", dot: "bg-accent" },
] as const;
const COMPONENTS = ["l", "a", "b"] as const;
const label = (k: (typeof COMPONENTS)[number]) => (k === "l" ? "L" : k);

/**
 * Keep the form's body array at least as long as Number of Bodies (N) and
 * return N. Bodies are never dropped when N goes down: their readings stay in
 * the form (hidden), so raising N again brings them back. Only Body 1 … N are
 * validated and saved.
 */
export function useBodyCount(countName: string, arrayName = "bodies"): number {
  const { control } = useFormContext<FieldValues>();
  const n = bodyCount(useWatch({ control, name: countName }));
  useRowsFor(n, arrayName, emptyBodyReadings);
  return n;
}

/**
 * Keep the array at `arrayName` at least `n` long, adding `make()` rows.
 * Never shortens it — rows above `n` stay (hidden) until the form is saved.
 */
export function useRowsFor(n: number, arrayName: string, make: () => unknown) {
  const { getValues, setValue } = useFormContext<FieldValues>();
  useEffect(() => {
    const current = (getValues(arrayName) as unknown[] | undefined) ?? [];
    if (current.length < n) setValue(arrayName, [...current, ...Array.from({ length: n - current.length }, make)]);
  }, [n, arrayName, make, getValues, setValue]);
}

/**
 * L, a, b Measurements for Body 1 … N: each body has a Post Press and a Post
 * Polish reading, each L, a, b. Fields live at `${name}.${i}.postPress.l` etc.
 */
export function BodyReadingsFields({ n: wanted, name = "bodies", idPrefix }: { n: number; name?: string; idPrefix: string }) {
  const { control, register, formState } = useFormContext<FieldValues>();
  // Draw a body once its values exist (added right after N changes).
  const ready = ((useWatch({ control, name }) as unknown[] | undefined) ?? []).length;
  const n = Math.min(wanted, ready);

  if (wanted < 1) {
    return (
      <p className="rounded-lg border border-dashed border-line-2 bg-mute-bg/40 px-4 py-6 text-center text-[14px] text-ink-2">
        Enter <strong>Number of Bodies (N)</strong> — L, a, b fields for each body appear here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: n }, (_, i) => {
        const body = `${name}.${i}`;
        return (
          <section key={i} aria-label={`Body ${i + 1}`} className="rounded-xl border border-line bg-white">
            <h3 className="border-b border-line bg-mute-bg/50 px-4 py-2.5 text-[13px] font-bold tracking-wide text-ink uppercase">
              Body {i + 1}
            </h3>
            <div className="space-y-2 p-3 sm:p-4">
              <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))] gap-2 px-1 text-xs font-bold text-ink-3 sm:grid-cols-[110px_repeat(3,minmax(0,1fr))]">
                <span />
                {COMPONENTS.map((k) => (
                  <span key={k} className="text-center">
                    {label(k)}
                  </span>
                ))}
              </div>
              {STAGES.map((st) => {
                const path = `${body}.${st.key}`;
                const errs = COMPONENTS.map((k) => errorAt(formState.errors, `${path}.${k}`)).filter(Boolean);
                return (
                  <div key={st.key}>
                    <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[110px_repeat(3,minmax(0,1fr))]">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                        <span className={cn("size-2 shrink-0 rounded-full", st.dot)} />
                        {st.title}
                      </span>
                      {COMPONENTS.map((k) => (
                        <input
                          key={k}
                          id={`${idPrefix}-b${i + 1}-${st.key}-${k}`}
                          aria-label={`Body ${i + 1} ${st.title} ${label(k)}`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={label(k)}
                          className={cn("input px-2 text-center tabular-nums", errorAt(formState.errors, `${path}.${k}`) && "input-error")}
                          {...register(`${path}.${k}`)}
                        />
                      ))}
                    </div>
                    {errs.length > 0 && (
                      <p className="mt-1 text-[13px] text-bad-fg" role="alert">
                        {st.title}: {errs[0]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

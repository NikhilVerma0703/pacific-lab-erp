"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { emptyBodyReadings } from "@/modules/forms/fields";
import { useRowsFor } from "./BodyReadingsFields";
import { errorAt } from "./errors";

const STAGES = [
  { key: "postPress", title: "Post Press", short: "pp", dot: "bg-brand" },
  { key: "postPolish", title: "Post Polish", short: "pl", dot: "bg-accent" },
] as const;
const COMPONENTS = ["l", "a", "b"] as const;
const label = (k: (typeof COMPONENTS)[number]) => (k === "l" ? "L" : k);

/**
 * L, a, b Measurements as a table: one row per body ("Body 1", "Roy Body 1",
 * "Chessboard Body 1" …), two column groups — Post Press (L, a, b) and Post
 * Polish (L, a, b). Fields live at `${name}.${i}.postPress.l` etc.; the array
 * is kept at least `n` long (rows above `n` stay hidden until the form is
 * saved). Ids: `${idPrefix}-${i+1}-pp-l` / `-pl-l` …
 */
export function StageRowsFields({ name, n: wanted, rowLabel, idPrefix }: { name: string; n: number; rowLabel: string; idPrefix: string }) {
  const { control, register, formState } = useFormContext<FieldValues>();
  useRowsFor(wanted, name, emptyBodyReadings);
  const ready = ((useWatch({ control, name }) as unknown[] | undefined) ?? []).length;
  const n = Math.min(wanted, ready);

  const grid = "grid gap-2 md:grid-cols-[140px_repeat(3,minmax(0,1fr))_12px_repeat(3,minmax(0,1fr))]";

  return (
    <div className="space-y-2">
      {/* Column heads (tablet / desktop) */}
      <div aria-hidden="true" className={cn(grid, "hidden px-1 md:grid")}>
        <span />
        <StageHead stage={STAGES[0]} />
        <span />
        <StageHead stage={STAGES[1]} />
        <span />
        {COMPONENTS.map((k) => (
          <span key={`pp-${k}`} className="text-center text-xs font-bold text-ink-3">
            {label(k)}
          </span>
        ))}
        <span />
        {COMPONENTS.map((k) => (
          <span key={`pl-${k}`} className="text-center text-xs font-bold text-ink-3">
            {label(k)}
          </span>
        ))}
      </div>

      {Array.from({ length: n }, (_, i) => {
        const path = `${name}.${i}`;
        const errs = STAGES.flatMap((st) =>
          COMPONENTS.map((k) => {
            const e = errorAt(formState.errors, `${path}.${st.key}.${k}`);
            return e ? `${st.title} ${e}` : null;
          }),
        ).filter(Boolean);
        return (
          <div key={i} role="group" aria-label={`${rowLabel} ${i + 1}`} className="rounded-lg border border-line p-3 md:border-0 md:p-0">
            <div className={cn(grid, "items-center")}>
              <span className="text-[13px] font-semibold text-ink md:text-ink-2">
                {rowLabel} {i + 1}
              </span>
              {STAGES.map((st, s) => (
                <div key={st.key} className="grid grid-cols-[88px_repeat(3,minmax(0,1fr))] items-center gap-2 md:contents">
                  {/* the narrow gap column between Post Press and Post Polish */}
                  {s === 1 && <span aria-hidden="true" className="hidden md:block" />}
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink-2 md:hidden">
                    <span className={cn("size-2 rounded-full", st.dot)} />
                    {st.title}
                  </span>
                  {COMPONENTS.map((k) => (
                    <input
                      key={k}
                      id={`${idPrefix}-${i + 1}-${st.short}-${k}`}
                      aria-label={`${rowLabel} ${i + 1} ${st.title} ${label(k)}`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={label(k)}
                      className={cn("input px-2 text-center tabular-nums", errorAt(formState.errors, `${path}.${st.key}.${k}`) && "input-error")}
                      {...register(`${path}.${st.key}.${k}`)}
                    />
                  ))}
                </div>
              ))}
            </div>
            {errs.length > 0 && (
              <p className="mt-1 text-[13px] text-bad-fg" role="alert">
                {rowLabel} {i + 1}: {errs[0]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StageHead({ stage }: { stage: (typeof STAGES)[number] }) {
  return (
    <span className="col-span-3 flex items-center justify-center gap-1.5 border-b-2 border-line pb-1 text-[12px] font-bold tracking-wide text-ink-2 uppercase">
      <span className={cn("size-2 rounded-full", stage.dot)} />
      {stage.title}
    </span>
  );
}

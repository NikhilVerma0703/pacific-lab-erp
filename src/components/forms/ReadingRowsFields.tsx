"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { emptyLabReading } from "@/modules/forms/fields";
import { useRowsFor } from "./BodyReadingsFields";
import { errorAt } from "./errors";

const COMPONENTS = ["l", "a", "b"] as const;
const label = (k: (typeof COMPONENTS)[number]) => (k === "l" ? "L" : k);

/**
 * One L, a, b reading per body — "Body 1", "Roy Body 1", "Chessboard Body 1" …
 * — for `n` bodies. Fields live at `${name}.${i}.l` etc.; the array is kept at
 * least `n` long (rows above `n` stay hidden until the form is saved).
 */
export function ReadingRowsFields({ name, n: wanted, rowLabel, idPrefix }: { name: string; n: number; rowLabel: string; idPrefix: string }) {
  const { control, register, formState } = useFormContext<FieldValues>();
  useRowsFor(wanted, name, emptyLabReading);
  const ready = ((useWatch({ control, name }) as unknown[] | undefined) ?? []).length;
  const n = Math.min(wanted, ready);

  return (
    <div className="grid gap-x-6 gap-y-2 lg:grid-cols-2">
      <ReadingRowsHead />
      {n > 1 && <ReadingRowsHead className="hidden lg:grid" />}
      {Array.from({ length: n }, (_, i) => {
        const path = `${name}.${i}`;
        const errs = COMPONENTS.map((k) => errorAt(formState.errors, `${path}.${k}`)).filter(Boolean);
        return (
          <div key={i} role="group" aria-label={`${rowLabel} ${i + 1}`}>
            <div className="grid grid-cols-[minmax(92px,auto)_repeat(3,minmax(0,1fr))] items-center gap-2 sm:grid-cols-[150px_repeat(3,minmax(0,1fr))]">
              <span className="text-[13px] font-semibold text-ink-2">
                {rowLabel} {i + 1}
              </span>
              {COMPONENTS.map((k) => (
                <input
                  key={k}
                  id={`${idPrefix}-${i + 1}-${k}`}
                  aria-label={`${rowLabel} ${i + 1} ${label(k)}`}
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
                {rowLabel} {i + 1}: {errs[0]}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Column heads L · a · b over a column of reading rows. */
function ReadingRowsHead({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("grid grid-cols-[minmax(92px,auto)_repeat(3,minmax(0,1fr))] gap-2 px-1 text-xs font-bold text-ink-3 sm:grid-cols-[150px_repeat(3,minmax(0,1fr))]", className)}
    >
      <span />
      {COMPONENTS.map((k) => (
        <span key={k} className="text-center">
          {label(k)}
        </span>
      ))}
    </div>
  );
}

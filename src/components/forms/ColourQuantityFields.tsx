"use client";

import { Trash2 } from "lucide-react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { normalizeKey } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import type { ColourQuantityInput } from "@/modules/forms/fields";
import type { MasterOption, MasterRef } from "@/modules/master-data/types";
import { errorAt } from "./errors";

const same = (a: MasterRef, b: MasterRef) => (a.id && b.id ? a.id === b.id : normalizeKey(a.label) === normalizeKey(b.label));

/**
 * "… Colors Used" — pick several colours (Pigments / Colours list, with
 * Other…), and give each its Quantity (gm). Rows live at `name` as
 * { colour, quantity }; picking or dropping a colour adds or removes its row,
 * keeping the quantities already typed (and anything else the row holds).
 * Also used for other picked-with-quantity lists (Additives Used) via `noun`.
 */
export function ColourQuantityFields({
  name,
  idPrefix,
  label,
  options,
  allowCustom,
  noun = "colour",
}: {
  name: string;
  idPrefix: string;
  label: string;
  options: MasterOption[];
  allowCustom: boolean;
  noun?: string;
}) {
  const { control, register, setValue, getValues, formState } = useFormContext<FieldValues>();
  const rows = ((useWatch({ control, name }) as ColourQuantityInput[] | undefined) ?? []).filter(Boolean);
  const listError = errorAt(formState.errors, name) ?? errorAt(formState.errors, `${name}.root`);

  function onColours(next: MasterRef[]) {
    const current = ((getValues(name) as ColourQuantityInput[] | undefined) ?? []).filter(Boolean);
    setValue(
      name,
      next.map((colour) => {
        const had = current.find((r) => same(r.colour, colour));
        return had ? { ...had, colour } : { colour, quantity: "" };
      }),
      { shouldDirty: true },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        <label className="label" htmlFor={`${idPrefix}-colours`}>
          {label}
        </label>
        <MasterPicker
          id={`${idPrefix}-colours`}
          multiple
          options={options}
          value={rows.map((r) => r.colour)}
          onChange={onColours}
          allowCustom={allowCustom}
          invalid={!!listError}
          noun={noun}
          placeholder={`Select ${noun}s`}
        />
        {listError && (
          <p className="mt-1 text-[13px] text-bad-fg" role="alert">
            {listError}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p className="label">Quantity (gm)</p>
        {rows.length === 0 ? (
          <div className="flex min-h-11 items-center rounded-lg border border-dashed border-line-2 px-3 text-[13px] text-ink-3">
            Select {/^[aeiou]/i.test(noun) ? "an" : "a"} {noun} to enter its quantity
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => {
              const qtyPath = `${name}.${i}.quantity`;
              const err = errorAt(formState.errors, qtyPath);
              const isNew = !r.colour.id;
              return (
                <li key={`${r.colour.id ?? r.colour.label}-${i}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <label htmlFor={`${idPrefix}-q-${i}`} className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold">
                      <span className="truncate">{r.colour.label}</span>
                      {isNew && <span className="badge shrink-0 bg-warn-bg text-warn-fg">new</span>}
                    </label>
                    <input
                      id={`${idPrefix}-q-${i}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`Quantity (gm) of ${r.colour.label}`}
                      className={cn("input", err && "input-error")}
                      placeholder="0"
                      {...register(qtyPath)}
                    />
                    <button
                      type="button"
                      className="icon-btn text-bad-fg"
                      aria-label={`Remove ${r.colour.label}`}
                      onClick={() => onColours(rows.filter((_, j) => j !== i).map((x) => x.colour))}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {err && <p className="mt-1 text-[13px] text-bad-fg">{err}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

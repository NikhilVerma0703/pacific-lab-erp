"use client";

import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { cn } from "@/lib/utils";
import { normalizeKey } from "@/lib/normalize";
import { MASTER, type MasterCode } from "@/modules/master-data/catalog";
import type { MasterRef } from "@/modules/master-data/types";
import { emptyComponentRow, type ComponentRowInput } from "@/modules/samples/schema";
import { errorAt, useSampleFormEnv } from "./form-context";

/**
 * The reusable formulation block: Resin, Grits, Filler rows and Pigments.
 * Rendered for the Main Body and for every Roy Body, in any form (lab sample,
 * inward/outward …) — one implementation, different `name` path. The form must
 * hold a FormulationInput at that path.
 */
export type FormulationPath = string;

export function FormulationFields({ name, idPrefix }: { name: FormulationPath; idPrefix: string }) {
  return (
    <div className="space-y-6">
      <MaterialRows name={name} idPrefix={idPrefix} kind="resins" title="Resin" list={MASTER.RESIN} />
      <MaterialRows name={name} idPrefix={idPrefix} kind="grits" title="Grits" list={MASTER.GRIT} withSize />
      <MaterialRows name={name} idPrefix={idPrefix} kind="fillers" title="Filler" list={MASTER.FILLER} />
      <PigmentFields name={name} idPrefix={idPrefix} />
    </div>
  );
}

export function UnitSelect({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <select id={id} className={cn("input", invalid && "input-error")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option value="GRAMS">grams (gm)</option>
      <option value="PERCENT">percentage (%)</option>
    </select>
  );
}

function MaterialRows({
  name,
  idPrefix,
  kind,
  title,
  list,
  withSize,
}: {
  name: FormulationPath;
  idPrefix: string;
  kind: "resins" | "grits" | "fillers";
  title: string;
  list: MasterCode;
  withSize?: boolean;
}) {
  const { control, register, formState } = useFormContext<FieldValues>();
  const { options, allowCustom } = useSampleFormEnv();
  const { fields, append, remove } = useFieldArray({ control, name: `${name}.${kind}` });
  const noun = title.toLowerCase().replace(/s$/, "");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h3>
      </div>
      <div className="space-y-3">
        {fields.map((f, i) => {
          const base = `${name}.${kind}.${i}` as const;
          const id = `${idPrefix}-${kind}-${i}`;
          const qtyErr = errorAt(formState.errors, `${base}.quantity`);
          return (
            <div
              key={f.id}
              className={cn(
                "grid grid-cols-1 gap-3 rounded-lg sm:grid-cols-2",
                withSize ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
                fields.length > 1 && "border border-line p-3 lg:border-0 lg:p-0",
              )}
            >
              <Field label={fields.length > 1 ? `${title} ${i + 1}` : title} htmlFor={`${id}-m`} className="sm:col-span-2 lg:col-span-1">
                <Controller
                  control={control}
                  name={`${base}.material`}
                  render={({ field }) => (
                    <MasterPicker
                      id={`${id}-m`}
                      options={options[list]}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowCustom={allowCustom}
                      noun={noun}
                      placeholder={`Select ${noun}`}
                    />
                  )}
                />
              </Field>
              {withSize && (
                <Field label="Size of Grits" htmlFor={`${id}-s`} className="sm:col-span-2 lg:col-span-1">
                  <Controller
                    control={control}
                    name={`${base}.size`}
                    render={({ field }) => (
                      <MasterPicker
                        id={`${id}-s`}
                        options={options[MASTER.GRIT_SIZE]}
                        value={field.value ?? null}
                        onChange={field.onChange}
                        allowCustom={allowCustom}
                        noun="size"
                        placeholder="Select size"
                      />
                    )}
                  />
                </Field>
              )}
              <Field label="Measurement" htmlFor={`${id}-u`}>
                <Controller
                  control={control}
                  name={`${base}.unit`}
                  render={({ field }) => <UnitSelect id={`${id}-u`} value={field.value ?? ""} onChange={field.onChange} />}
                />
              </Field>
              <Field label="Quantity" htmlFor={`${id}-q`} error={qtyErr}>
                <input
                  id={`${id}-q`}
                  inputMode="decimal"
                  autoComplete="off"
                  className={cn("input", qtyErr && "input-error")}
                  placeholder="0"
                  {...register(`${base}.quantity`)}
                />
              </Field>
              <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                {fields.length > 1 && (
                  <button type="button" className="icon-btn text-bad-fg" aria-label={`Remove ${title} ${i + 1}`} onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn-ghost btn-sm mt-2 text-accent" onClick={() => append(emptyComponentRow())}>
        <Plus className="size-4" /> Add another {noun}
      </button>
    </div>
  );
}

/**
 * Pigments: pick any number of colours from a searchable list (or add new
 * ones); each selected colour gets its own Quantity box on the right.
 * No unit field for pigments yet — a unit already stored on an older sample is
 * kept as it is.
 */
function PigmentFields({ name, idPrefix }: { name: FormulationPath; idPrefix: string }) {
  const { control, register, formState, getValues, setValue } = useFormContext<FieldValues>();
  const { options, allowCustom } = useSampleFormEnv();
  const { fields, append, remove } = useFieldArray({ control, name: `${name}.pigments` });
  const rows = (useWatch({ control, name: `${name}.pigments` }) ?? []) as ComponentRowInput[];

  const selected: MasterRef[] = rows.map((r) => r.material).filter((m): m is MasterRef => !!m);
  const sameRef = (a: MasterRef, b: MasterRef) => (a.id && b.id ? a.id === b.id : normalizeKey(a.label) === normalizeKey(b.label));

  function onColoursChange(next: MasterRef[]) {
    const current = (getValues(`${name}.pigments`) ?? []) as ComponentRowInput[];
    // Remove rows whose colour was deselected (highest index first).
    current
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.material && !next.some((n) => sameRef(n, r.material!)))
      .reverse()
      .forEach(({ i }) => remove(i));
    // Add rows for newly selected colours; keep the "save to list" tick in sync.
    for (const n of next) {
      const idx = current.findIndex((r) => r.material && sameRef(r.material, n));
      if (idx < 0) append({ ...emptyComponentRow(), material: n }, { shouldFocus: false });
      else if (!n.id && current[idx].material?.save !== n.save) {
        setValue(`${name}.pigments.${idx}.material`, n, { shouldDirty: true });
      }
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">Pigment</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Field label="Color Used" htmlFor={`${idPrefix}-pig`}>
          <MasterPicker
            id={`${idPrefix}-pig`}
            multiple
            options={options[MASTER.PIGMENT]}
            value={selected}
            onChange={onColoursChange}
            allowCustom={allowCustom}
            noun="colour"
            placeholder="Select colours"
          />
        </Field>

        <div className="min-w-0">
          <p className="label">Quantity</p>
          {fields.length === 0 ? (
            <div className="flex min-h-11 items-center rounded-lg border border-dashed border-line-2 px-3 text-[13px] text-ink-3">
              Select a colour to enter its quantity
            </div>
          ) : (
            <ul className="space-y-2">
              {fields.map((f, i) => {
                const base = `${name}.pigments.${i}` as const;
                const qtyErr = errorAt(formState.errors, `${base}.quantity`);
                const label = rows[i]?.material?.label ?? "—";
                const isNew = !!rows[i]?.material && !rows[i]?.material?.id;
                return (
                  <li key={f.id}>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                      <label htmlFor={`${idPrefix}-pq-${i}`} className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold">
                        <span className="truncate">{label}</span>
                        {isNew && <span className="badge shrink-0 bg-warn-bg text-warn-fg">new</span>}
                      </label>
                      <input
                        id={`${idPrefix}-pq-${i}`}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Quantity of ${label}`}
                        className={cn("input", qtyErr && "input-error")}
                        placeholder="0"
                        {...register(`${base}.quantity`)}
                      />
                      <button type="button" className="icon-btn text-bad-fg" aria-label={`Remove ${label}`} onClick={() => remove(i)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {qtyErr && <p className="mt-1 text-[13px] text-bad-fg">{qtyErr}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

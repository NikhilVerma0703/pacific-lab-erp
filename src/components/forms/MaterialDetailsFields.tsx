"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { cn } from "@/lib/utils";
import { emptyGritRow, emptyMaterialRow, emptyMaterials, type MaterialRowInput } from "@/modules/forms/materials";
import { MASTER, type MasterCode } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { useRowsFor } from "./BodyReadingsFields";
import { ColourQuantityFields } from "./ColourQuantityFields";
import { errorAt } from "./errors";

type Env = { options: MasterOptions; allowCustom: boolean };

/**
 * Material Details for `n` bodies — one collapsible card per body ("Body 1",
 * "Roy Body 1" …). The form holds a MaterialsInput[] at `name`; the array is
 * kept at least `n` long (cards above `n` stay hidden until the form is saved).
 */
export function MaterialBodiesFields({ name, n: wanted, bodyLabel, idPrefix, env }: { name: string; n: number; bodyLabel: string; idPrefix: string; env: Env }) {
  const { control } = useFormContext<FieldValues>();
  useRowsFor(wanted, name, emptyMaterials);
  const ready = ((useWatch({ control, name }) as unknown[] | undefined) ?? []).length;
  const n = Math.min(wanted, ready);
  return (
    <div className="space-y-4">
      {Array.from({ length: n }, (_, i) => (
        <MaterialDetailsCard key={i} name={`${name}.${i}`} title={`${bodyLabel} ${i + 1}`} idPrefix={`${idPrefix}-${i + 1}`} env={env} />
      ))}
    </div>
  );
}

/**
 * One body's Material Details:
 *   Material Choices — Resin, Grits (+ Size of Grit), Filler; each Quantity (gm)
 *   Pigments / Additives Details — Color Used, Additives Used; each Quantity (gm)
 */
export function MaterialDetailsCard({ name, title, idPrefix, env }: { name: string; title: string; idPrefix: string; env: Env }) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-label={`${title} Material Details`} className="overflow-hidden rounded-xl border border-brand/25 bg-shell">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-brand px-4 py-2.5 text-left text-white"
      >
        <span className="text-[14px] font-bold tracking-widest uppercase">{title}</span>
        <span className="text-[13px] text-white/80">— Material Details</span>
        <ChevronDown className={cn("ml-auto size-5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="space-y-4 p-3 sm:p-4">
          <Part title="Material Choices">
            <div className="space-y-5">
              <MaterialRows name={`${name}.resins`} idPrefix={`${idPrefix}-resin`} title="Resin" list={MASTER.RESIN} env={env} />
              <MaterialRows name={`${name}.grits`} idPrefix={`${idPrefix}-grit`} title="Grits" list={MASTER.GRIT} env={env} withSize />
              <MaterialRows name={`${name}.fillers`} idPrefix={`${idPrefix}-filler`} title="Filler" list={MASTER.FILLER} env={env} />
            </div>
          </Part>
          <Part title="Pigments / Additives Details">
            <div className="space-y-5">
              <div>
                <h5 className="mb-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">Pigments</h5>
                <ColourQuantityFields name={`${name}.pigments`} idPrefix={`${idPrefix}-pigments`} label="Color Used" options={env.options[MASTER.PIGMENT]} allowCustom={env.allowCustom} />
              </div>
              <div>
                <h5 className="mb-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">Additives</h5>
                <ColourQuantityFields
                  name={`${name}.additives`}
                  idPrefix={`${idPrefix}-additives`}
                  label="Additives Used"
                  options={env.options[MASTER.ADDITIVE] ?? []}
                  allowCustom={env.allowCustom}
                  noun="additive"
                />
              </div>
            </div>
          </Part>
        </div>
      )}
    </section>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold tracking-wide text-ink uppercase">{title}</h4>
      {children}
    </section>
  );
}

/**
 * Resin / Grits / Filler: one or more rows — the material (typed or picked;
 * a new name is added to its list on save), Size of Grit for grits, and
 * Quantity (gm).
 */
function MaterialRows({
  name,
  idPrefix,
  title,
  list,
  env,
  withSize,
}: {
  name: string;
  idPrefix: string;
  title: string;
  list: MasterCode;
  env: Env;
  withSize?: boolean;
}) {
  const { control, register, formState } = useFormContext<FieldValues>();
  const { fields, append, remove } = useFieldArray({ control, name });
  const rows = (useWatch({ control, name }) ?? []) as MaterialRowInput[];
  const noun = title.toLowerCase().replace(/s$/, "");

  return (
    <div>
      <h5 className="mb-2 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h5>
      <div className="space-y-3">
        {fields.map((f, i) => {
          const base = `${name}.${i}`;
          const id = `${idPrefix}-${i}`;
          const matErr = errorAt(formState.errors, `${base}.material`) ?? errorAt(formState.errors, `${base}.material.label`);
          const qtyErr = errorAt(formState.errors, `${base}.quantity`);
          const numbered = fields.length > 1 ? `${title} ${i + 1}` : title;
          return (
            <div
              key={f.id}
              className={cn(
                "grid grid-cols-1 gap-3 sm:grid-cols-2",
                withSize ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_40px]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_40px]",
                fields.length > 1 && "rounded-lg border border-line p-3 lg:border-0 lg:p-0",
              )}
            >
              <Field label={numbered} htmlFor={`${id}-m`} error={matErr} className={cn(!withSize && "sm:col-span-2 lg:col-span-1")}>
                <Controller
                  control={control}
                  name={`${base}.material`}
                  render={({ field }) => (
                    <MasterPicker
                      id={`${id}-m`}
                      options={env.options[list] ?? []}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      allowCustom={env.allowCustom}
                      invalid={!!matErr}
                      noun={noun}
                      placeholder={`Type or select ${noun}`}
                    />
                  )}
                />
              </Field>
              {withSize && (
                <Field label="Size of Grit" htmlFor={`${id}-s`} error={errorAt(formState.errors, `${base}.size.label`)}>
                  <Controller
                    control={control}
                    name={`${base}.size`}
                    render={({ field }) => (
                      <MasterPicker
                        id={`${id}-s`}
                        options={env.options[MASTER.GRIT_SIZE] ?? []}
                        value={field.value ?? null}
                        onChange={field.onChange}
                        allowCustom={env.allowCustom}
                        noun="size"
                        placeholder="Type or select size"
                      />
                    )}
                  />
                </Field>
              )}
              <Field label={rows[i]?.unit === "PERCENT" ? "Quantity (%)" : "Quantity (gm)"} htmlFor={`${id}-q`} error={qtyErr}>
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
                  <button type="button" className="icon-btn text-bad-fg" aria-label={`Remove ${numbered}`} onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn-ghost btn-sm mt-2 text-accent" onClick={() => append(withSize ? emptyGritRow() : emptyMaterialRow())}>
        <Plus className="size-4" /> Add another {noun}
      </button>
    </div>
  );
}

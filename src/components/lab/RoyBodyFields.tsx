"use client";

import { useFormContext, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { MAX_BODIES } from "@/modules/samples/schema";
import { errorAt } from "./form-context";
import { FormulationFields } from "./FormulationFields";
import { LabRowsFields, NoBodiesHint, useBodyRows } from "./LabRowsFields";
import { VeinFields } from "./VeinFields";

/**
 * The complete Roy Body opened from Design:
 *   Number of Bodies (n) → Material Choices & Pigments → Vein → L, a, b Values
 * The form must hold a RoyBodyInput at `name`.
 */
export function RoyBodyFields({ name, idPrefix }: { name: string; idPrefix: string }) {
  const form = useFormContext<FieldValues>();
  const { register, formState } = form;
  const n = useBodyRows(form as UseFormReturn<FieldValues>, `${name}.numberOfBodies`, [`${name}.postPress`, `${name}.postPolish`]);
  const nErr = errorAt(formState.errors, `${name}.numberOfBodies`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Number of Bodies (n)" htmlFor={`${idPrefix}-n`} error={nErr}>
          <input
            id={`${idPrefix}-n`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_BODIES}
            className={cn("input tabular-nums", nErr && "input-error")}
            {...register(`${name}.numberOfBodies`)}
          />
        </Field>
      </div>

      <SubSection title="Material Choices & Pigments">
        <FormulationFields name={name} idPrefix={idPrefix} />
      </SubSection>

      <SubSection title="Vein">
        <VeinFields
          prefix={`${name}.`}
          idPrefix={`${idPrefix}-`}
          royIdPrefix={`${idPrefix}v`}
          royTitle="Roy Body Formulation — Vein of this Roy Body"
        />
      </SubSection>

      <SubSection title="L, a, b Values">
        {n < 1 ? (
          <NoBodiesHint />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
            <div className="lg:pr-6">
              <LabRowsFields name={`${name}.postPress`} n={n} title="Post Press" labelPrefix="Roy Body " />
            </div>
            <div className="lg:border-l-2 lg:border-line-2 lg:pl-6">
              <LabRowsFields name={`${name}.postPolish`} n={n} title="Post Polish" dot="accent" labelPrefix="Roy Body " />
            </div>
          </div>
        )}
      </SubSection>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h4>
      {children}
    </section>
  );
}

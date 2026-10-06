"use client";

import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { Segmented } from "@/components/ui/Segmented";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import type { MasterRef } from "@/modules/master-data/types";
import { errorAt, hasCode, useSampleFormEnv } from "./form-context";
import { FormulationFields } from "./FormulationFields";

/**
 * The Vein block: Vein Yes/No, Mixer Type (the mixer used on the vein), How
 * Vein Introduced, Vein details, and the Roy Body formulation that opens when
 * ROY BODY is one of the methods. Used by the sample form and inside a Roy
 * Body; `prefix` is where its fields live ("" or "designRoyBody.").
 */
export function VeinFields({
  prefix = "",
  idPrefix = "",
  royIdPrefix,
  royTitle,
}: {
  prefix?: string;
  idPrefix?: string;
  royIdPrefix: string;
  royTitle: string;
}) {
  const { control, register, formState } = useFormContext<FieldValues>();
  const { options, allowCustom } = useSampleFormEnv();
  const p = (name: string) => `${prefix}${name}`;
  const id = (name: string) => `${idPrefix}${name}`;
  const hasVein = useWatch({ control, name: p("hasVein") }) as string;
  const methods = (useWatch({ control, name: p("veinMethods") }) ?? []) as MasterRef[];
  const showRoy = hasVein !== "NO" && hasCode(methods, options[MASTER.VEIN_METHOD], VALUE_CODE.ROY_BODY);

  return (
    <div className="space-y-4">
      <Field label="Vein" htmlFor={id("hasVein")}>
        <Controller
          control={control}
          name={p("hasVein")}
          render={({ field }) => (
            <Segmented
              id={id("hasVein")}
              value={field.value ?? ""}
              onChange={field.onChange}
              options={[
                { value: "YES", label: "Yes — has vein" },
                { value: "NO", label: "No vein" },
              ]}
            />
          )}
        />
      </Field>
      {/* Mixer Type sits with the vein: which mixer is used on the vein. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Mixer Type" htmlFor={id("mixerType")}>
          <Controller
            control={control}
            name={p("mixerType")}
            render={({ field }) => (
              <MasterPicker
                id={id("mixerType")}
                options={options[MASTER.MIXER_TYPE]}
                value={field.value ?? null}
                onChange={field.onChange}
                allowCustom={allowCustom}
                noun="mixer type"
                placeholder="Select mixer type"
              />
            )}
          />
        </Field>
      </div>
      {hasVein !== "NO" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="How Vein Introduced"
            htmlFor={id("veinMethods")}
            error={errorAt(formState.errors, p("veinMethods"))}
            hint="Select every technique used."
          >
            <Controller
              control={control}
              name={p("veinMethods")}
              render={({ field }) => (
                <MasterPicker
                  id={id("veinMethods")}
                  multiple
                  options={options[MASTER.VEIN_METHOD]}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  allowCustom={allowCustom}
                  noun="method"
                  placeholder="Select methods"
                />
              )}
            />
          </Field>
          <Field
            label="Vein details"
            htmlFor={id("veinNotes")}
            error={errorAt(formState.errors, p("veinNotes"))}
            hint="Colour, thickness, direction …"
          >
            <textarea id={id("veinNotes")} rows={2} className="input" {...register(p("veinNotes"))} />
          </Field>
        </div>
      )}
      {showRoy && (
        <FormSection tone="nested" index="R" title={royTitle} description="Opened because ROY BODY is selected in How Vein Introduced">
          <FormulationFields name={p("veinRoyBody")} idPrefix={royIdPrefix} />
        </FormSection>
      )}
    </div>
  );
}

"use client";

import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { FormSection } from "@/components/ui/FormSection";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { Segmented } from "@/components/ui/Segmented";
import { MASTER, VALUE_CODE } from "@/modules/master-data/catalog";
import type { MasterRef } from "@/modules/master-data/types";
import { errorAt, hasCode, useSampleFormEnv } from "./form-context";
import { RoyBodyFields } from "./RoyBodyFields";

/**
 * Plain / Non-Plain body, the pattern multi-select, and the Roy Body form that
 * opens when ROY BODY is picked (by default the complete Roy Body: n,
 * formulation, vein, L/a/b; a form can pass a different one via `roy`). Used by every form that
 * records a design; the form must have `designCategory`, `designPatterns`
 * and `designRoyBody` fields under `prefix` (each body's own, e.g. "bodies.0.").
 */
export function DesignFields({
  prefix = "",
  idPrefix,
  royTitle = "Roy Body Formulation — Design",
  roy,
}: {
  /** Where the fields live, e.g. "bodies.0." for Body 1. */
  prefix?: string;
  idPrefix: string;
  royTitle?: string;
  /** What the Roy Body form holds. Defaults to the complete Roy Body (lab sample / inward). */
  roy?: React.ReactNode;
}) {
  const { control, formState } = useFormContext<FieldValues>();
  const { options, allowCustom } = useSampleFormEnv();
  const p = (name: string) => `${prefix}${name}`;
  const category = useWatch({ control, name: p("designCategory") }) as string;
  const patterns = (useWatch({ control, name: p("designPatterns") }) ?? []) as MasterRef[];
  const showRoy = category === "NON_PLAIN_BODY" && hasCode(patterns, options[MASTER.DESIGN_PATTERN], VALUE_CODE.ROY_BODY);

  return (
    <div className="space-y-4">
      <Field label="Design" htmlFor={`${idPrefix}-designCategory`}>
        <Controller
          control={control}
          name={p("designCategory")}
          render={({ field }) => (
            <Segmented
              id={`${idPrefix}-designCategory`}
              value={field.value ?? ""}
              onChange={field.onChange}
              options={[
                { value: "PLAIN_BODY", label: "Plain Body" },
                { value: "NON_PLAIN_BODY", label: "Non-Plain Body" },
              ]}
            />
          )}
        />
      </Field>
      {category === "NON_PLAIN_BODY" && (
        <Field
          label="Design Pattern(s)"
          htmlFor={`${idPrefix}-designPatterns`}
          error={errorAt(formState.errors, p("designPatterns"))}
          hint="Pick every pattern / body on the slab."
        >
          <Controller
            control={control}
            name={p("designPatterns")}
            render={({ field }) => (
              <MasterPicker
                id={`${idPrefix}-designPatterns`}
                multiple
                options={options[MASTER.DESIGN_PATTERN]}
                value={field.value ?? []}
                onChange={field.onChange}
                allowCustom={allowCustom}
                noun="pattern"
                placeholder="Select patterns"
              />
            )}
          />
        </Field>
      )}
      {showRoy && (
        <FormSection tone="nested" index="R" title={royTitle} description="Opened because ROY BODY is selected">
          {roy ?? <RoyBodyFields name={p("designRoyBody")} idPrefix={`${idPrefix}roy`} />}
        </FormSection>
      )}
    </div>
  );
}

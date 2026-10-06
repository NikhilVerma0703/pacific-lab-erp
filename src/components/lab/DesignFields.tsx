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
 * Plain / Non-Plain body, the pattern multi-select, and the complete Roy Body
 * (n, formulation, vein, L/a/b) that opens when ROY BODY is picked. Used by every form that
 * records a design; the form must have `designCategory`, `designPatterns`
 * and `designRoyBody` fields.
 */
export function DesignFields({ idPrefix, royTitle = "Roy Body Formulation — Design" }: { idPrefix: string; royTitle?: string }) {
  const { control, formState } = useFormContext<FieldValues>();
  const { options, allowCustom } = useSampleFormEnv();
  const category = useWatch({ control, name: "designCategory" }) as string;
  const patterns = (useWatch({ control, name: "designPatterns" }) ?? []) as MasterRef[];
  const showRoy = category === "NON_PLAIN_BODY" && hasCode(patterns, options[MASTER.DESIGN_PATTERN], VALUE_CODE.ROY_BODY);

  return (
    <div className="space-y-4">
      <Field label="Design" htmlFor={`${idPrefix}-designCategory`}>
        <Controller
          control={control}
          name="designCategory"
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
          htmlFor="designPatterns"
          error={errorAt(formState.errors, "designPatterns")}
          hint="Pick every pattern / body on the slab."
        >
          <Controller
            control={control}
            name="designPatterns"
            render={({ field }) => (
              <MasterPicker
                id="designPatterns"
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
          <RoyBodyFields name="designRoyBody" idPrefix={`${idPrefix}roy`} />
        </FormSection>
      )}
    </div>
  );
}

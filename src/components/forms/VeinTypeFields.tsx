"use client";

import { Controller, useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { Segmented } from "@/components/ui/Segmented";
import { labelLimit, MASTER } from "@/modules/master-data/catalog";
import type { MasterOptions } from "@/modules/master-data/types";
import { ColourQuantityFields } from "./ColourQuantityFields";
import { errorAt } from "./errors";

/**
 * Kreos / Vein design type: Vein Present – Yes / No. With Yes: Mixer Type
 * (Mixer Types list — Grit, Filler, Pure, Other…), Vein Details (Vein
 * Details list), "Kreos Vein Colors Used" / "Vein Colors Used" with a
 * Quantity (gm) per colour. With No the vein fields disappear.
 *
 * The form holds a VeinTypeInput at `name`. Ids: `${idPrefix}-present`,
 * `-mixer`, `-details`, `-colours-colours`, `-colours-q-<i>`.
 */
export function VeinTypeFields({
  type,
  name,
  idPrefix,
  options,
  allowCustom,
}: {
  type: "KREOS" | "VEIN";
  name: string;
  idPrefix: string;
  options: MasterOptions;
  allowCustom: boolean;
}) {
  const { control, formState } = useFormContext<FieldValues>();
  const errors = formState.errors;
  const present = useWatch({ control, name: `${name}.veinPresent` });
  const id = (f: string) => `${idPrefix}-${f}`;
  return (
    <div className="space-y-4">
      <Controller
        control={control}
        name={`${name}.veinPresent`}
        render={({ field }) => (
          <Segmented
            id={id("present")}
            value={field.value ?? ""}
            onChange={field.onChange}
            options={[
              { value: "YES", label: "Vein Present – Yes" },
              { value: "NO", label: "Vein Present – No" },
            ]}
          />
        )}
      />
      {present === "YES" && (
        <div className="space-y-4 border-l-4 border-accent/50 pl-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label="Mixer Type" htmlFor={id("mixer")} error={errorAt(errors, `${name}.mixerType.label`)}>
              <Controller
                control={control}
                name={`${name}.mixerType`}
                render={({ field }) => (
                  <MasterPicker
                    id={id("mixer")}
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
            <Field label="Vein Details" htmlFor={id("details")} error={errorAt(errors, `${name}.veinDetails`) ?? errorAt(errors, `${name}.veinDetails.root`)}>
              <Controller
                control={control}
                name={`${name}.veinDetails`}
                render={({ field }) => (
                  <MasterPicker
                    id={id("details")}
                    multiple
                    options={options[MASTER.VEIN_DETAIL]}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    allowCustom={allowCustom}
                    maxLength={labelLimit(MASTER.VEIN_DETAIL)}
                    noun="vein detail"
                    placeholder="Select vein details"
                  />
                )}
              />
            </Field>
          </div>
          <ColourQuantityFields
            name={`${name}.colours`}
            idPrefix={id("colours")}
            label={type === "KREOS" ? "Kreos Vein Colors Used" : "Vein Colors Used"}
            options={options[MASTER.PIGMENT]}
            allowCustom={allowCustom}
          />
        </div>
      )}
    </div>
  );
}

/** A titled box inside a section (e.g. "Kreos Vein Details", "Carrara Colors"). */
export function SubPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h4>
      {children}
    </section>
  );
}

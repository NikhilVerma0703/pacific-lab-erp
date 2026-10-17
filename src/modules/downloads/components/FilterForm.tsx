"use client";

import { Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { normalizeKey } from "@/lib/normalize";
import type { MasterOption, MasterRef } from "@/modules/master-data/types";
import { SAMPLE_TYPE_OPTIONS, type ExportFilters, type SampleType } from "../filters";
import { periodProblem, type Period } from "../period";
import { ProductionDateFields } from "./ProductionDateFields";

/**
 * The filter bar. A plain GET form: Apply puts the filters in the URL, the
 * server renders the matching records, and the export link reuses the same URL.
 */
export function FilterForm({
  today,
  initial,
  types,
  sampleDesigns,
  designTypes,
}: {
  today: string;
  initial: ExportFilters;
  /** The reports this user may see. */
  types: SampleType[];
  /** Every Design Name saved on the three forms. */
  sampleDesigns: string[];
  /** Every design type saved on the three forms. */
  designTypes: string[];
}) {
  const [period, setPeriod] = useState<Period>(initial.period);
  const [tried, setTried] = useState(false);
  const designOptions = useMemo<MasterOption[]>(() => sampleDesigns.map((label) => ({ id: label, label, code: null, isActive: true })), [sampleDesigns]);
  const [design, setDesign] = useState<MasterRef | null>(() => {
    const found = sampleDesigns.find((d) => normalizeKey(d) === normalizeKey(initial.sampleDesign));
    return initial.sampleDesign ? { id: found ?? initial.sampleDesign, label: found ?? initial.sampleDesign } : null;
  });
  const typeChoices = initial.designType && !designTypes.some((t) => normalizeKey(t) === normalizeKey(initial.designType)) ? [...designTypes, initial.designType] : designTypes;
  const problem = periodProblem(period);

  return (
    <form
      method="get"
      action="/downloads#filtered"
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        if (problem) {
          e.preventDefault();
          setTried(true);
        }
      }}
    >
      <input type="hidden" name="apply" value="1" />
      {/* Row 1: the Production Date every filter and result is for. */}
      <div className="flex flex-wrap items-end gap-4">
        <ProductionDateFields idPrefix="f" value={period} onChange={setPeriod} today={today} named error={tried ? problem : null} />
      </div>
      {tried && problem && (
        <p className="-mt-2 text-[13px] text-bad-fg" role="alert">
          {problem}
        </p>
      )}

      {/* Row 2: which form, then any combination of filters — every one chosen must match. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sample Type" htmlFor="f-type">
          <select id="f-type" name="type" className="input" defaultValue={initial.sampleType}>
            {SAMPLE_TYPE_OPTIONS.filter((o) => types.includes(o.value)).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sample Design" htmlFor="f-sdesign">
          <MasterPicker
            id="f-sdesign"
            options={designOptions}
            value={design}
            onChange={setDesign}
            allowCustom={false}
            placeholder="All sample designs"
            noun="sample design"
          />
          <input type="hidden" name="sdesign" value={design?.label ?? ""} />
        </Field>
        <Field label="Design Type" htmlFor="f-dtype">
          <select id="f-dtype" name="dtype" className="input" defaultValue={typeChoices.find((t) => normalizeKey(t) === normalizeKey(initial.designType)) ?? ""}>
            <option value="">All design types</option>
            {typeChoices.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          <Filter className="size-4" /> Apply
        </button>
        <Link href="/downloads#filtered" className="btn-ghost">
          <RotateCcw className="size-4" /> Clear filters
        </Link>
      </div>
    </form>
  );
}

"use client";

import { Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { SAMPLE_TYPE_OPTIONS, type ExportFilters } from "../filters";
import { periodProblem, type Period } from "../period";
import { ProductionDateFields } from "./ProductionDateFields";

interface Opt {
  id: string;
  label: string;
}

/**
 * The filter bar. A plain GET form: Apply puts the filters in the URL, the
 * server renders the matching records, and the export link reuses the same URL.
 */
export function FilterForm({
  today,
  initial,
  patterns,
  showProduction,
}: {
  today: string;
  initial: ExportFilters;
  patterns: Opt[];
  /** Offer "Production Samples" (users who may view them). */
  showProduction: boolean;
}) {
  const [design, setDesign] = useState(initial.design);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [tried, setTried] = useState(false);
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

      {/* Rows below: any combination of filters — every one chosen must match. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sample Type" htmlFor="f-type">
          <select id="f-type" name="type" className="input" defaultValue={initial.sampleType}>
            <option value="">All sample types</option>
            {SAMPLE_TYPE_OPTIONS.filter((o) => showProduction || o.value !== "PRODUCTION").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Design" htmlFor="f-design">
          <select id="f-design" name="design" className="input" value={design} onChange={(e) => setDesign(e.target.value as typeof design)}>
            <option value="">All designs</option>
            <option value="PLAIN_BODY">Plain Body</option>
            <option value="NON_PLAIN_BODY">Non-Plain Body</option>
          </select>
        </Field>
        <Field label="Design Pattern" htmlFor="f-pattern">
          <select id="f-pattern" name="pattern" className="input" defaultValue={initial.pattern} disabled={design === "PLAIN_BODY"}>
            <option value="">All patterns</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
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

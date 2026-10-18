"use client";

import { RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { REPORT_PREFIX, SAMPLE_TYPE_OPTIONS, type ReportSearch, type SampleType } from "../filters";
import { periodProblem, type Period } from "../period";
import { ProductionDateFields } from "./ProductionDateFields";

/**
 * Sample Data Download: pick the Production Date and the report, then Search.
 * A plain GET form — the page lists the matching records and the Excel link
 * reuses the same query, so the two always hold the same records.
 */
export function ReportSearchForm({ today, initial, types }: { today: string; initial: ReportSearch; types: SampleType[] }) {
  const [period, setPeriod] = useState<Period>(initial.period);
  const [tried, setTried] = useState(false);
  const problem = periodProblem(period);
  const options = SAMPLE_TYPE_OPTIONS.filter((o) => types.includes(o.value));

  return (
    <form
      method="get"
      action="/downloads#report-results"
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        if (problem) {
          e.preventDefault();
          setTried(true);
        }
      }}
    >
      <input type="hidden" name="show" value="1" />
      <div className="flex flex-wrap items-end gap-4">
        <ProductionDateFields idPrefix="dl" value={period} onChange={setPeriod} today={today} named namePrefix={REPORT_PREFIX} error={tried ? problem : null} />
        <Field label="Download" htmlFor="dl-kind" className="w-full sm:min-w-64 sm:flex-1">
          <select id="dl-kind" name="report" className="input" defaultValue={initial.sampleType}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {tried && problem && (
        <p className="-mt-2 text-[13px] text-bad-fg" role="alert">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={!options.length}>
          <Search className="size-4" /> Search
        </button>
        <Link href="/downloads" className="btn-ghost">
          <RotateCcw className="size-4" /> Clear filters
        </Link>
      </div>
    </form>
  );
}

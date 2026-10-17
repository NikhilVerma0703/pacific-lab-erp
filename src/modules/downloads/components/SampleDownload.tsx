"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/Field";
import { countsForPeriodAction } from "../actions";
import { SAMPLE_TYPE_OPTIONS, type SampleType } from "../filters";
import { defaultPeriod, periodPhrase, periodProblem, periodQuery, type Period } from "../period";
import { downloadExcel } from "./download-file";
import { ProductionDateFields } from "./ProductionDateFields";

type Counts = { samples: number; inward: number; production: number };

/** Download kind of each report (the API's `kind`). */
const KIND: Record<SampleType, string> = { LAB: "lab", INWARD: "inward", PRODUCTION: "production" };
const NOUN: Record<SampleType, [string, string]> = {
  LAB: ["lab sample", "lab samples"],
  INWARD: ["inward / outward sample", "inward / outward samples"],
  PRODUCTION: ["production sample", "production samples"],
};

/**
 * Sample Data Download: pick the Production Date and one of the three
 * reports — Lab Sample, Sample Inward/Outward or Production Sample — and get
 * that form's complete data as Excel.
 */
export function SampleDownload({ today, types }: { today: string; types: SampleType[] }) {
  const options = SAMPLE_TYPE_OPTIONS.filter((o) => types.includes(o.value));
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(today));
  const [type, setType] = useState<SampleType>(options[0]?.value ?? "LAB");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, start] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const problem = periodProblem(period);
  const { mode, date, from, to } = period;

  useEffect(() => {
    const next: Period = { mode, date, from, to };
    if (periodProblem(next)) return setCounts(null);
    start(async () => setCounts(await countsForPeriodAction(next)));
  }, [mode, date, from, to]);

  const records = !counts ? null : type === "LAB" ? counts.samples : type === "INWARD" ? counts.inward : counts.production;

  async function download() {
    if (problem) return toast.error(problem);
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ kind: KIND[type], ...periodQuery(period) });
      const name = await downloadExcel(`/api/downloads?${qs}`, "samples.xlsx");
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const phrase = periodPhrase(period);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <ProductionDateFields idPrefix="dl" value={period} onChange={setPeriod} today={today} error={problem} />
        <Field label="Download" htmlFor="dl-kind" className="w-full sm:min-w-64 sm:flex-1">
          <select id="dl-kind" className="input" value={type} onChange={(e) => setType(e.target.value as SampleType)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={download} disabled={downloading || !!problem || !options.length}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {downloading ? "Preparing…" : "Download Excel"}
        </button>
      </div>
      {problem && (
        <p className="text-[13px] text-bad-fg" role="alert">
          {problem}
        </p>
      )}
      <div className="flex items-start gap-3 rounded-lg bg-mute-bg/70 px-4 py-3 text-[13px] text-ink-2">
        <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="font-semibold text-ink" aria-live="polite">
          {problem
            ? "Choose the Production Date to see how many records it has."
            : loading || records === null
              ? "Checking records…"
              : `${records} ${NOUN[type][records === 1 ? 0 : 1]} ${phrase}.`}
        </p>
      </div>
    </div>
  );
}

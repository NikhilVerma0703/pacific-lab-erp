"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/Field";
import { countsForPeriodAction } from "../actions";
import { defaultPeriod, periodPhrase, periodProblem, periodQuery, type Period } from "../period";
import { downloadExcel } from "./download-file";
import { ProductionDateFields } from "./ProductionDateFields";

const OPTIONS = [
  { value: "entry", label: "Data Entry Sample" },
  { value: "inward", label: "Inward / Outward Sample" },
  { value: "complete", label: "Complete Sample Report" },
] as const;

type Counts = { samples: number; inward: number; production: number };

export function SampleDownload({ today }: { today: string }) {
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(today));
  const [kind, setKind] = useState<(typeof OPTIONS)[number]["value"]>("entry");
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

  const records = !counts ? null : kind === "entry" ? counts.samples : kind === "inward" ? counts.inward : null;

  async function download() {
    if (problem) return toast.error(problem);
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ kind, ...periodQuery(period) });
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
        <Field label="Download" htmlFor="dl-kind" className="w-full sm:min-w-56 sm:flex-1">
          <select id="dl-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={download} disabled={downloading || !!problem}>
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
        <p className="font-semibold text-ink">
          {problem
            ? "Choose the Production Date to see how many records it has."
            : loading || !counts
              ? "Checking records…"
              : records !== null
                ? `${records} record${records === 1 ? "" : "s"} ${phrase}.`
                : `${counts.samples} lab sample${counts.samples === 1 ? "" : "s"} and ${counts.inward} inward / outward entr${counts.inward === 1 ? "y" : "ies"} ${phrase}.`}
        </p>
      </div>
    </div>
  );
}

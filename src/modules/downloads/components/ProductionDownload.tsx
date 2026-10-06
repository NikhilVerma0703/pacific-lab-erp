"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/Field";
import { countsForPeriodAction } from "../actions";
import { defaultPeriod, periodPhrase, periodProblem, periodQuery, type Period } from "../period";
import { downloadExcel } from "./download-file";
import { ProductionDateFields } from "./ProductionDateFields";

/**
 * Production Sample Data Download — same as Sample Data Download, but there is
 * nothing to choose: the Excel holds the Production Samples of the period.
 */
export function ProductionDownload({ today }: { today: string }) {
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(today));
  const [count, setCount] = useState<number | null>(null);
  const [loading, start] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const problem = periodProblem(period);
  const { mode, date, from, to } = period;

  useEffect(() => {
    const next: Period = { mode, date, from, to };
    if (periodProblem(next)) return setCount(null);
    start(async () => setCount((await countsForPeriodAction(next))?.production ?? null));
  }, [mode, date, from, to]);

  async function download() {
    if (problem) return toast.error(problem);
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ kind: "production", ...periodQuery(period) });
      const name = await downloadExcel(`/api/downloads?${qs}`, "production-samples.xlsx");
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <ProductionDateFields idPrefix="pdl" value={period} onChange={setPeriod} today={today} error={problem} />
        <Field label="Download" htmlFor="pdl-kind" className="w-full sm:min-w-56 sm:flex-1">
          <input id="pdl-kind" className="input bg-mute-bg text-ink-2" value="Production Sample Data" readOnly tabIndex={-1} />
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
            : loading || count === null
              ? "Checking records…"
              : `${count} production sample${count === 1 ? "" : "s"} ${periodPhrase(period)}.`}
        </p>
      </div>
    </div>
  );
}

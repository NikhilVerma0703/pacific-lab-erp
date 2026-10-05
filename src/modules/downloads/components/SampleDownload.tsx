"use client";

import { CalendarDays, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/ui/Field";
import { countsForDateAction } from "../actions";

const OPTIONS = [
  { value: "entry", label: "Data Entry Sample" },
  { value: "inward", label: "Inward / Outward Sample" },
  { value: "complete", label: "Complete Sample Report" },
] as const;

export function SampleDownload({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<(typeof OPTIONS)[number]["value"]>("entry");
  const [counts, setCounts] = useState<{ samples: number; inward: number } | null>(null);
  const [loading, start] = useTransition();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!date) return setCounts(null);
    start(async () => setCounts(await countsForDateAction(date)));
  }, [date]);

  const records = !counts ? null : kind === "entry" ? counts.samples : kind === "inward" ? counts.inward : null;

  async function download() {
    if (!date) return toast.error("Choose a date first.");
    setDownloading(true);
    try {
      const res = await fetch(`/api/downloads?kind=${kind}&date=${date}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Download failed (${res.status}).`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "samples.xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
        <Field label="Date" htmlFor="dl-date">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input id="dl-date" type="date" className="input pl-9" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
        </Field>
        <Field label="Download" htmlFor="dl-kind">
          <select id="dl-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="btn-primary sm:col-span-2 lg:col-span-1" onClick={download} disabled={downloading || !date}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {downloading ? "Preparing…" : "Download Excel"}
        </button>
      </div>
      <div className="flex items-start gap-3 rounded-lg bg-mute-bg/70 px-4 py-3 text-[13px] text-ink-2">
        <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <p className="font-semibold text-ink">
            {loading || !counts
              ? "Checking records…"
              : records !== null
                ? `${records} record${records === 1 ? "" : "s"} on this date.`
                : `${counts.samples} lab sample${counts.samples === 1 ? "" : "s"} and ${counts.inward} inward / outward entr${counts.inward === 1 ? "y" : "ies"} on this date.`}
          </p>
        </div>
      </div>
    </div>
  );
}

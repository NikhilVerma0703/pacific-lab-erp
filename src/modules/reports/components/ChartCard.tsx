"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** A report panel: title, optional controls, and a Chart / Table switch. */
export function ChartCard({
  title,
  description,
  controls,
  kpi,
  chart,
  table,
  empty,
}: {
  title: string;
  description?: React.ReactNode;
  controls?: React.ReactNode;
  kpi?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="card min-w-0">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {description && <p className="text-[13px] text-ink-2">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <div className="flex rounded-lg border border-line-2 p-0.5" role="radiogroup" aria-label={`${title} view`}>
            {(
              [
                ["chart", BarChart3, "Chart"],
                ["table", Table2, "Table"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold",
                  view === v ? "bg-brand text-white" : "text-ink-2 hover:bg-mute-bg",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="px-3 py-4 sm:px-5">
        {kpi}
        {empty ?? (view === "chart" ? chart : <div className="overflow-x-auto">{table}</div>)}
      </div>
    </section>
  );
}

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg bg-mute-bg/60 px-6 text-center text-sm text-ink-3">
      {children}
    </div>
  );
}

/** Small shared tooltip body. */
export function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-lg border border-line bg-white px-3 py-2 text-[13px] shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="font-semibold text-ink tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

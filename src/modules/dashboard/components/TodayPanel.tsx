"use client";

import { FlaskConical, Layers, Palette } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { DashboardData } from "../queries";

const VISIBLE_DESIGNS = 8;

export function TodayPanel({ data }: { data: DashboardData["todayStats"] }) {
  const [allOpen, setAllOpen] = useState(false);
  const shown = data.designs.slice(0, VISIBLE_DESIGNS);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Total samples */}
      <div className="card flex flex-col p-5">
        <CardTitle icon={<FlaskConical className="size-4" />}>Total Samples Made Today</CardTitle>
        <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">{data.total}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Split label="Lab" value={data.lab} />
          <Split label="Line" value={data.line} hint="Not recorded yet" />
        </div>
      </div>

      {/* Designs */}
      <div className="card flex flex-col p-5">
        <CardTitle icon={<Palette className="size-4" />}>Designs Worked On Today</CardTitle>
        <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">{data.designs.length}</p>
        {data.designs.length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">No designs recorded today yet.</p>
        ) : (
          <>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {shown.map((d) => (
                <DesignChip key={d.name} name={d.name} count={d.count} />
              ))}
            </ul>
            {data.designs.length > VISIBLE_DESIGNS && (
              <button type="button" className="btn-ghost btn-sm mt-3 self-start text-brand-2" onClick={() => setAllOpen(true)}>
                <Layers className="size-4" /> View all designs ({data.designs.length})
              </button>
            )}
          </>
        )}
      </div>

      <Dialog open={allOpen} onClose={() => setAllOpen(false)} title={`Designs worked on today (${data.designs.length})`} size="md">
        <ul className="flex flex-wrap gap-1.5">
          {data.designs.map((d) => (
            <DesignChip key={d.name} name={d.name} count={d.count} />
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-ink-2 uppercase">
      <span className="flex size-7 items-center justify-center rounded-lg bg-info-bg text-info-fg">{icon}</span>
      {children}
    </p>
  );
}

function Split({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg bg-mute-bg/70 px-3 py-2">
      <p className="text-[12px] font-semibold text-ink-2">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

function DesignChip({ name, count }: { name: string; count: number }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[13px] font-medium">
      {name}
      {count > 1 && <span className="rounded bg-mute-bg px-1 text-[11px] font-bold text-ink-2 tabular-nums">×{count}</span>}
    </li>
  );
}

"use client";

import { FlaskConical, Layers, Palette, PieChart as PieIcon } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Dialog } from "@/components/ui/Dialog";
import { SERIES } from "@/modules/reports/components/palette";
import type { DashboardData } from "../queries";

const VISIBLE_DESIGNS = 8;

export function TodayPanel({ data }: { data: DashboardData["todayStats"] }) {
  const [allOpen, setAllOpen] = useState(false);
  const shown = data.designs.slice(0, VISIBLE_DESIGNS);
  const typed = data.creative + data.inspired;
  const slices = [
    { name: "Creative", value: data.creative, color: SERIES[0] },
    { name: "Inspired", value: data.inspired, color: SERIES[1] },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
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

      {/* By type */}
      <div className="card flex flex-col p-5">
        <CardTitle icon={<PieIcon className="size-4" />}>Samples by Type</CardTitle>
        <div className="mt-2 flex flex-1 items-center gap-4">
          <div className="relative size-32 shrink-0" role="img" aria-label={`${data.creative} creative, ${data.inspired} inspired`}>
            {typed === 0 ? (
              <div className="flex size-full items-center justify-center rounded-full border-[14px] border-mute-bg text-xs text-ink-3">none</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={slices.every((s) => s.value > 0) ? 3 : 0}
                    stroke="#fff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {slices.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] shadow-lg">
                          {payload[0].name}: <strong>{payload[0].value}</strong>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {typed > 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">{typed}</span>
            )}
          </div>
          <ul className="flex-1 space-y-3">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="size-3 rounded-sm" style={{ background: s.color }} />
                <span className="flex-1 text-[14px] text-ink-2">{s.name} Samples</span>
                <span className="text-xl font-bold tabular-nums">{s.value}</span>
              </li>
            ))}
            {typed > 0 && (
              <li className="text-[12px] text-ink-3">
                {Math.round((data.creative / typed) * 100)}% creative · {Math.round((data.inspired / typed) * 100)}% inspired
              </li>
            )}
          </ul>
        </div>
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

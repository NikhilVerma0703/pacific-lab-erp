"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ConsumptionData, MaterialKind, ReportData } from "../build";
import { MATERIAL_KINDS, OTHER } from "../build";
import { ChartCard, EmptyChart, Legend, TipBox } from "./ChartCard";
import { countDomain, countTicks, formatGrams, longDate, shortDate } from "./format";
import { AXIS, GRID, OTHER_COLOR, PRODUCTION_SAMPLE_COLOR, SERIES } from "./palette";

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: GRID },
} as const;

// ── 2 · Sample production ────────────────────────────────────────────────────

export function ProductionChart({ data }: { data: ReportData }) {
  const max = Math.max(0, ...data.production.map((d) => d.count));
  const domain = countDomain(max);
  return (
    <ChartCard
      title="Sample Production / Creation"
      description="Slabs / samples created on each date"
      empty={data.totals.samples === 0 ? <EmptyChart>No samples dated in this period.</EmptyChart> : undefined}
      chart={
        <div className="h-72" role="img" aria-label="Line chart of samples created per date">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.production} margin={{ top: 16, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={18} {...axisProps} />
              <YAxis domain={domain} ticks={countTicks(domain[1])} allowDecimals={false} {...axisProps} />
              <Tooltip
                cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TipBox
                      title={longDate(String(label))}
                      rows={[{ label: "Samples created", value: String(payload[0].value), color: SERIES[0] }]}
                    />
                  ) : null
                }
              />
              <Line
                type="linear"
                dataKey="count"
                stroke={SERIES[0]}
                strokeWidth={2}
                dot={{ r: 4, fill: SERIES[0], stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th text-right">Samples created</th>
            </tr>
          </thead>
          <tbody>
            {data.production.map((d) => (
              <tr key={d.date}>
                <td className="td">{longDate(d.date)}</td>
                <td className="td text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
            <tr>
              <td className="td font-bold">Total</td>
              <td className="td text-right font-bold tabular-nums">{data.totals.samples}</td>
            </tr>
          </tbody>
        </table>
      }
    />
  );
}

// ── Production Samples (received from the plant) ───────────────────────────

export function ProductionSamplesChart({ data }: { data: ReportData }) {
  const max = Math.max(0, ...data.productionSamples.map((d) => d.count));
  const domain = countDomain(max);
  const total = data.totals.productionSamples;
  const color = PRODUCTION_SAMPLE_COLOR;
  return (
    <ChartCard
      title="Production Samples"
      description={`Production samples on each date · ${total} in the last ${data.days} days`}
      empty={total === 0 ? <EmptyChart>No production samples dated in this period.</EmptyChart> : undefined}
      chart={
        <div className="h-72" role="img" aria-label="Line chart of production samples per date">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.productionSamples} margin={{ top: 16, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={18} {...axisProps} />
              <YAxis
                domain={domain}
                ticks={countTicks(domain[1])}
                allowDecimals={false}
                {...axisProps}
                label={{ value: "Production Samples", angle: -90, position: "insideLeft", offset: 26, fill: AXIS, fontSize: 12, style: { textAnchor: "middle" } }}
              />
              <Tooltip
                cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TipBox title={longDate(String(label))} rows={[{ label: "Production samples", value: String(payload[0].value), color }]} />
                  ) : null
                }
              />
              <Line
                type="linear"
                dataKey="count"
                name="Production samples"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th text-right">Production samples</th>
            </tr>
          </thead>
          <tbody>
            {data.productionSamples.map((d) => (
              <tr key={d.date}>
                <td className="td">{longDate(d.date)}</td>
                <td className="td text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
            <tr>
              <td className="td font-bold">Total</td>
              <td className="td text-right font-bold tabular-nums">{total}</td>
            </tr>
          </tbody>
        </table>
      }
    />
  );
}

// ── 3 · Creative vs Inspired ─────────────────────────────────────────────────

export function CreativeInspiredChart({ data }: { data: ReportData }) {
  const max = Math.max(0, ...data.creativeVsInspired.flatMap((d) => [d.creative, d.inspired]));
  const domain = countDomain(max);
  const series = [
    { key: "creative", label: "Creative Samples", color: SERIES[0] },
    { key: "inspired", label: "Inspired Samples", color: SERIES[1] },
  ] as const;
  return (
    <ChartCard
      title="Creative vs Inspired Samples"
      description={`${data.totals.creative} creative · ${data.totals.inspired} inspired${data.totals.otherType ? ` · ${data.totals.otherType} other / no type` : ""}`}
      empty={data.totals.creative + data.totals.inspired === 0 ? <EmptyChart>No Creative or Inspired samples in this period.</EmptyChart> : undefined}
      chart={
        <>
          <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
          <div className="h-72" role="img" aria-label="Grouped bar chart of creative and inspired samples per date">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.creativeVsInspired} margin={{ top: 8, right: 16, bottom: 4, left: -16 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={18} {...axisProps} />
                <YAxis domain={domain} ticks={countTicks(domain[1])} allowDecimals={false} {...axisProps} />
                <Tooltip
                  cursor={{ fill: "rgba(31,58,95,0.06)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <TipBox
                        title={longDate(String(label))}
                        rows={series.map((s) => ({
                          label: s.label,
                          value: String(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                          color: s.color,
                        }))}
                      />
                    ) : null
                  }
                />
                {series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      }
      table={
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th text-right">Creative</th>
              <th className="th text-right">Inspired</th>
            </tr>
          </thead>
          <tbody>
            {data.creativeVsInspired.map((d) => (
              <tr key={d.date}>
                <td className="td">{longDate(d.date)}</td>
                <td className="td text-right tabular-nums">{d.creative}</td>
                <td className="td text-right tabular-nums">{d.inspired}</td>
              </tr>
            ))}
            <tr>
              <td className="td font-bold">Total</td>
              <td className="td text-right font-bold tabular-nums">{data.totals.creative}</td>
              <td className="td text-right font-bold tabular-nums">{data.totals.inspired}</td>
            </tr>
          </tbody>
        </table>
      }
    />
  );
}

// ── 4 · Design analysis ──────────────────────────────────────────────────────

export function DesignChart({ data }: { data: ReportData }) {
  const rows = data.designs;
  const height = Math.max(160, rows.length * 40 + 40);
  const longest = Math.max(0, ...rows.map((r) => r.pattern.length));
  return (
    <ChartCard
      title="Design Analysis"
      description={
        <>
          Samples per design pattern, highest first. A sample with several patterns counts once for each. Inspired samples use the design recorded in Inward / Outward.
          {data.totals.withoutDesign > 0 && ` ${data.totals.withoutDesign} sample(s) have no design recorded yet.`}
        </>
      }
      empty={rows.length === 0 ? <EmptyChart>No designs recorded in this period.</EmptyChart> : undefined}
      chart={
        <div style={{ height }} role="img" aria-label="Horizontal bar chart of samples per design pattern">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis
                type="category"
                dataKey="pattern"
                width={Math.min(200, Math.max(90, Math.round(longest * 8.5) + 20))}
                {...axisProps}
                tick={{ fill: "#4a5a6a", fontSize: 13 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(31,58,95,0.06)" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TipBox
                      title={String(payload[0].payload.pattern)}
                      rows={[{ label: "Samples", value: String(payload[0].value), color: SERIES[0] }]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="count" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fill: "#4a5a6a", fontSize: 12, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <th className="th">Design Pattern</th>
              <th className="th text-right">Samples</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pattern}>
                <td className="td">{r.pattern}</td>
                <td className="td text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

// ── 5 · Material consumption ─────────────────────────────────────────────────

export function ConsumptionChart({ data }: { data: ReportData }) {
  const [kind, setKind] = useState<MaterialKind>("RESIN");
  const c: ConsumptionData = data.consumption[kind];
  const label = MATERIAL_KINDS.find((m) => m.kind === kind)!.label;
  const colorOf = (s: string, i: number) => (s === OTHER ? OTHER_COLOR : SERIES[i % SERIES.length]);
  const topKey = c.series[c.series.length - 1];

  const selector = (
    <div className="flex flex-wrap rounded-lg border border-line-2 p-0.5" role="radiogroup" aria-label="Material category">
      {MATERIAL_KINDS.map((m) => (
        <button
          key={m.kind}
          type="button"
          role="radio"
          aria-checked={kind === m.kind}
          onClick={() => setKind(m.kind)}
          className={cn(
            "min-h-9 rounded-md px-3 text-[13px] font-semibold",
            kind === m.kind ? "bg-accent text-white" : "text-ink-2 hover:bg-mute-bg",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  const notes: string[] = [];
  if (c.missingQtyRows) notes.push(`${c.missingQtyRows} had no quantity`);

  return (
    <ChartCard
      title="Material Consumption"
      description="Weight used per date across all formulations (main body and Roy Bodies), stacked by material"
      controls={selector}
      kpi={
        <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 px-1">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Total {label} consumption · selected period</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{formatGrams(c.totalGrams)}</p>
          </div>
          {c.byMaterial[0] && (
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Most used</p>
              <p className="text-[15px] font-semibold">
                {c.byMaterial[0].material} <span className="font-normal text-ink-2">· {formatGrams(c.byMaterial[0].grams)}</span>
              </p>
            </div>
          )}
          {notes.length > 0 && <p className="basis-full text-[12px] text-ink-3">Note: {notes.join("; ")}.</p>}
        </div>
      }
      empty={c.totalGrams === 0 ? <EmptyChart>No {label.toLowerCase()} quantities in grams recorded in this period.</EmptyChart> : undefined}
      chart={
        <>
          <Legend items={c.series.map((s, i) => ({ label: s, color: colorOf(s, i) }))} />
          <div className="h-80" role="img" aria-label={`Stacked bar chart of ${label} consumption per date`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.byDate} margin={{ top: 8, right: 16, bottom: 4, left: 4 }} barCategoryGap="22%">
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={18} {...axisProps} />
                <YAxis tickFormatter={(v: number) => (v >= 10000 ? `${v / 1000}k` : String(v))} {...axisProps} width={52} />
                <Tooltip
                  cursor={{ fill: "rgba(31,58,95,0.06)" }}
                  content={({ active, payload, label: d }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((a, p) => a + Number(p.value ?? 0), 0);
                    return (
                      <TipBox
                        title={longDate(String(d))}
                        rows={[
                          ...c.series
                            .map((s, i) => ({ s, i, v: Number(payload.find((p) => p.dataKey === s)?.value ?? 0) }))
                            .filter((x) => x.v > 0)
                            .map((x) => ({ label: x.s, value: formatGrams(x.v), color: colorOf(x.s, x.i) })),
                          { label: "Total", value: formatGrams(total) },
                        ]}
                      />
                    );
                  }}
                />
                {c.series.map((s, i) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    stackId="m"
                    fill={colorOf(s, i)}
                    stroke="#fff"
                    strokeWidth={1}
                    radius={s === topKey ? [4, 4, 0, 0] : 0}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      }
      table={
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <th className="th">{label}</th>
                <th className="th text-right">Consumed</th>
              </tr>
            </thead>
            <tbody>
              {c.byMaterial.map((m) => (
                <tr key={m.material}>
                  <td className="td">{m.material}</td>
                  <td className="td text-right tabular-nums">{formatGrams(m.grams)}</td>
                </tr>
              ))}
              <tr>
                <td className="td font-bold">Total</td>
                <td className="td text-right font-bold tabular-nums">{formatGrams(c.totalGrams)}</td>
              </tr>
            </tbody>
          </table>
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th text-right">Consumed</th>
              </tr>
            </thead>
            <tbody>
              {c.byDate.map((r) => {
                const total = c.series.reduce((a, s) => a + Number(r[s] ?? 0), 0);
                return (
                  <tr key={String(r.date)}>
                    <td className="td">{longDate(String(r.date))}</td>
                    <td className="td text-right tabular-nums">{total ? formatGrams(total) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
    />
  );
}

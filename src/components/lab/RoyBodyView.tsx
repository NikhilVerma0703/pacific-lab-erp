"use client";

import { cn, formatNumber } from "@/lib/utils";
import type { FormulationDTO } from "@/modules/samples/queries";
import { FormulationView } from "./FormulationView";

/** Read-only view of the complete Roy Body: n → materials → vein → L/a/b. */
export function RoyBodyView({ f }: { f?: FormulationDTO | null }) {
  if (!f) return <p className="text-sm text-ink-3">Not recorded.</p>;
  const n = f.numberOfBodies ?? 0;
  const showVeinDetails = f.hasVein !== false;
  const nestedRoy = f.veinMethods.some((m) => m.code === "ROY_BODY");

  return (
    <div className="space-y-4">
      <Pairs items={[["Number of Bodies", f.numberOfBodies]]} />

      <Sub title="Material Choices & Pigments">
        <FormulationView f={f} />
      </Sub>

      <Sub title="Vein">
        <Pairs
          items={[
            ["Vein", f.hasVein === null ? null : f.hasVein ? "Yes" : "No"],
            ["Mixer Type", f.mixerType?.label],
            ...(showVeinDetails
              ? ([
                  ["How Vein Introduced", f.veinMethods.map((m) => m.label).join(", ")],
                  ["Vein details", f.veinNotes],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
        {nestedRoy && (
          <div className="mt-4 rounded-lg border border-accent/40 bg-accent-bg/40 p-3">
            <p className="mb-2 text-[13px] font-bold">Roy Body Formulation — Vein of this Roy Body</p>
            <FormulationView f={f.veinRoyBody} />
          </div>
        )}
      </Sub>

      <Sub title="L, a, b Values">
        {n < 1 ? (
          <p className="text-sm text-ink-3">Not recorded.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
            {(["POST_PRESS", "POST_POLISH"] as const).map((stage) => (
              <div key={stage} className={cn(stage === "POST_POLISH" ? "lg:border-l-2 lg:border-line-2 lg:pl-6" : "lg:pr-6")}>
                <p className="mb-2 text-[13px] font-bold tracking-wide text-brand uppercase">{stage === "POST_PRESS" ? "Post Press" : "Post Polish"}</p>
                <table className="w-full text-[14px]">
                  <thead>
                    <tr>
                      <th className="th">Body</th>
                      <th className="th">L</th>
                      <th className="th normal-case">a</th>
                      <th className="th normal-case">b</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: n }, (_, i) => {
                      const m = f.measurements.find((x) => x.stage === stage && x.bodyIndex === i + 1);
                      return (
                        <tr key={i}>
                          <td className="td font-semibold">Body {i + 1}</td>
                          <td className="td tabular-nums">{formatNumber(m?.l)}</td>
                          <td className="td tabular-nums">{formatNumber(m?.a)}</td>
                          <td className="td tabular-nums">{formatNumber(m?.b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Sub>
    </div>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h5 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h5>
      {children}
    </section>
  );
}

function Pairs({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => {
        const empty = value === null || value === undefined || value === "";
        return (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd className={cn("text-[15px]", empty ? "text-ink-3" : "font-semibold")}>{empty ? "—" : value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

"use client";

import { formatNumber } from "@/lib/utils";
import type { ComponentDTO, FormulationDTO } from "@/modules/samples/queries";

const UNIT: Record<string, string> = { GRAMS: "gm", PERCENT: "%" };

/** Read-only Resin / Grits / Filler / Pigment tables for any formulation. */
export function FormulationView({ f }: { f?: FormulationDTO }) {
  if (!f || f.components.length === 0) return <p className="text-sm text-ink-3">Not recorded.</p>;
  const rows = (k: ComponentDTO["kind"]) => f.components.filter((c) => c.kind === k);
  const pigments = rows("PIGMENT");
  // Pigments have no unit field any more; older samples may still carry one.
  const pigmentUnits = pigments.some((c) => c.unit);
  const material = (title: string, list: ComponentDTO[], withSize = false) =>
    list.length === 0 ? null : (
      <div>
        <h4 className="mb-1.5 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr>
                <th className="th">{title}</th>
                {withSize && <th className="th">Size of Grits</th>}
                <th className="th">Measurement</th>
                <th className="th">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => (
                <tr key={i}>
                  <td className="td font-semibold">{c.material?.label ?? "—"}</td>
                  {withSize && <td className="td">{c.size?.label ?? "—"}</td>}
                  <td className="td">{c.unit === "GRAMS" ? "grams (gm)" : c.unit === "PERCENT" ? "percentage (%)" : "—"}</td>
                  <td className="td tabular-nums">
                    {c.quantity !== null ? `${formatNumber(c.quantity)} ${c.unit ? UNIT[c.unit] : ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  return (
    <div className="space-y-5">
      {material("Resin", rows("RESIN"))}
      {material("Grits", rows("GRIT"), true)}
      {material("Filler", rows("FILLER"))}
      <div>
        <h4 className="mb-1.5 text-[13px] font-bold tracking-wide text-ink-2 uppercase">Pigment</h4>
        {pigments.length === 0 ? (
          <p className="text-sm text-ink-3">Not recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th">Color</th>
                  <th className="th">Quantity</th>
                  {pigmentUnits && <th className="th">Unit</th>}
                </tr>
              </thead>
              <tbody>
                {pigments.map((c, i) => (
                  <tr key={i}>
                    <td className="td font-semibold">{c.material?.label ?? "—"}</td>
                    <td className="td tabular-nums">{formatNumber(c.quantity)}</td>
                    {pigmentUnits && (
                      <td className="td">{c.unit === "GRAMS" ? "grams (gm)" : c.unit === "PERCENT" ? "percentage (%)" : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

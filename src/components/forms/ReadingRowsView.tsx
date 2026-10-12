import { formatNumber } from "@/lib/utils";

type Reading = { l: string | null; a: string | null; b: string | null } | null;

/** Read-only L, a, b — one row per body ("Body 1", "Roy Body 1" …). */
export function ReadingRowsView({ rows, rowLabel }: { rows: Reading[]; rowLabel: string }) {
  if (!rows.length) return <p className="text-sm text-ink-3">Not recorded.</p>;
  return (
    <div className="max-w-2xl overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr>
            <th className="th">{rowLabel}</th>
            <th className="th text-right">L</th>
            <th className="th text-right normal-case">a</th>
            <th className="th text-right normal-case">b</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => (
            <tr key={i}>
              <td className="td font-semibold whitespace-nowrap">
                {rowLabel} {i + 1}
              </td>
              <td className="td text-right tabular-nums">{formatNumber(v?.l)}</td>
              <td className="td text-right tabular-nums">{formatNumber(v?.a)}</td>
              <td className="td text-right tabular-nums">{formatNumber(v?.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

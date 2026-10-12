import { cn, formatNumber } from "@/lib/utils";

type LabValue = { l: string | null; a: string | null; b: string | null } | null;

/** Read-only L, a, b table: one row per body, Post Press (L, a, b) and Post Polish (L, a, b) columns. */
export function StageRowsView({ rows }: { rows: { label: string; postPress: LabValue; postPolish: LabValue }[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-3">Not recorded.</p>;
  const cell = (v: string | null | undefined) => <td className="td text-center tabular-nums">{formatNumber(v)}</td>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr>
            <th className="th" rowSpan={2}>
              Body
            </th>
            {(["Post Press", "Post Polish"] as const).map((t, i) => (
              <th key={t} colSpan={3} className={cn("th text-center", i === 1 && "border-l-2 border-line")}>
                <span className={cn("mr-1.5 inline-block size-2 rounded-full", i === 0 ? "bg-brand" : "bg-accent")} />
                {t}
              </th>
            ))}
          </tr>
          <tr>
            {["L", "a", "b", "L", "a", "b"].map((k, i) => (
              <th key={i} className={cn("th text-center normal-case", i === 3 && "border-l-2 border-line")}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="td font-semibold whitespace-nowrap">{r.label}</td>
              {cell(r.postPress?.l)}
              {cell(r.postPress?.a)}
              {cell(r.postPress?.b)}
              <td className="td border-l-2 border-line text-center tabular-nums">{formatNumber(r.postPolish?.l)}</td>
              {cell(r.postPolish?.a)}
              {cell(r.postPolish?.b)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

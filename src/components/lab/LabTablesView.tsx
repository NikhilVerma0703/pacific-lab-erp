import { cn, formatNumber } from "@/lib/utils";

export interface LabReading {
  stage: "POST_PRESS" | "POST_POLISH";
  bodyIndex: number;
  l: string | null;
  a: string | null;
  b: string | null;
}

/** Read-only Post Press | Post Polish tables, one row per body. */
export function LabTablesView({ n, readings }: { n: number | null; readings: LabReading[] }) {
  if (!n) return <p className="text-sm text-ink-3">Not recorded.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
      {(["POST_PRESS", "POST_POLISH"] as const).map((stage) => (
        <div key={stage} className={cn(stage === "POST_POLISH" ? "lg:border-l-2 lg:border-line-2 lg:pl-6" : "lg:pr-6")}>
          <h4 className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-brand uppercase">
            <span className={cn("size-2.5 rounded-full", stage === "POST_PRESS" ? "bg-brand" : "bg-accent")} />
            {stage === "POST_PRESS" ? "Post Press" : "Post Polish"}
          </h4>
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
                const m = readings.find((x) => x.stage === stage && x.bodyIndex === i + 1);
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
  );
}

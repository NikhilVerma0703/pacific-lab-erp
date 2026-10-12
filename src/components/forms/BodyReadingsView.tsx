import { cn, formatNumber } from "@/lib/utils";

type Reading = { l: string | null; a: string | null; b: string | null } | null;

/** Read-only L, a, b for Body 1 … N: Post Press and Post Polish per body. */
export function BodyReadingsView({ bodies }: { bodies: { index: number; postPress: Reading; postPolish: Reading }[] }) {
  if (!bodies.length) return <p className="text-sm text-ink-3">Number of Bodies not recorded.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {bodies.map((b) => (
        <section key={b.index} aria-label={`Body ${b.index}`} className="overflow-hidden rounded-xl border border-line bg-white">
          <h3 className="border-b border-line bg-mute-bg/50 px-4 py-2.5 text-[13px] font-bold tracking-wide text-ink uppercase">
            Body {b.index}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th">Stage</th>
                  <th className="th text-right">L</th>
                  <th className="th text-right normal-case">a</th>
                  <th className="th text-right normal-case">b</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Post Press", b.postPress, "bg-brand"],
                    ["Post Polish", b.postPolish, "bg-accent"],
                  ] as const
                ).map(([title, v, dot]) => (
                  <tr key={title}>
                    <td className="td font-semibold whitespace-nowrap">
                      <span className={cn("mr-1.5 inline-block size-2 rounded-full", dot)} />
                      {title}
                    </td>
                    <td className="td text-right tabular-nums">{formatNumber(v?.l)}</td>
                    <td className="td text-right tabular-nums">{formatNumber(v?.a)}</td>
                    <td className="td text-right tabular-nums">{formatNumber(v?.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

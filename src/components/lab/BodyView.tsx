import { cn, formatNumber } from "@/lib/utils";

/** Read-only Body 1 … n, matching the body sections of the forms. */
export function BodyViewCard({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <section aria-label={`Body ${index}`} className="overflow-hidden rounded-xl border border-brand/25 bg-shell">
      <h3 className="bg-brand px-4 py-2.5 text-[14px] font-bold tracking-widest text-white uppercase">Body {index}</h3>
      <div className="space-y-4 p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function BodyViewPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h4>
      {children}
    </section>
  );
}

type LabValue = { l: string | null; a: string | null; b: string | null } | null;

/** One body's L, a, b: Post Press / Post Polish rows, or a single reading. */
export function BodyLabTable({ rows }: { rows: { title?: string; value: LabValue; dot?: "brand" | "accent" }[] }) {
  if (rows.every((r) => !r.value)) return <p className="text-sm text-ink-3">Not recorded.</p>;
  const withTitles = rows.some((r) => r.title);
  return (
    <div className="max-w-2xl overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr>
            {withTitles && <th className="th">Stage</th>}
            <th className="th">L</th>
            <th className="th normal-case">a</th>
            <th className="th normal-case">b</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {withTitles && (
                <td className="td font-semibold whitespace-nowrap">
                  <span className={cn("mr-1.5 inline-block size-2 rounded-full", r.dot === "accent" ? "bg-accent" : "bg-brand")} />
                  {r.title}
                </td>
              )}
              <td className="td tabular-nums">{formatNumber(r.value?.l)}</td>
              <td className="td tabular-nums">{formatNumber(r.value?.a)}</td>
              <td className="td tabular-nums">{formatNumber(r.value?.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shown above the bodies of a record saved before body-wise entry. */
export function LegacyBodiesNote({ parts = "Material, Design and Vein" }: { parts?: string }) {
  return (
    <p className="rounded-lg bg-info-bg px-4 py-3 text-[13px] text-info-fg">
      Recorded before body-wise entry — its one {parts} apply to every body, so they are shown on each. Edit and save to record each body
      separately.
    </p>
  );
}

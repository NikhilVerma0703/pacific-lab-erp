import { FileSearch } from "lucide-react";
import Link from "next/link";
import { formatDate, formatNumber } from "@/lib/utils";
import { reviewHref, SOURCE_LABEL, type SlabMatch, type SlabRow } from "../queries";

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

function Review({ r }: { r: Pick<SlabRow, "source" | "id" | "serialNo"> }) {
  return (
    <Link href={reviewHref(r.source, r.id)} className="btn-secondary btn-sm whitespace-nowrap" aria-label={`Review ${SOURCE_LABEL[r.source]} S.No. ${r.serialNo}`}>
      <FileSearch className="size-3.5" /> Review
    </Link>
  );
}

/** Where a result came from — a tinted badge, so the three forms stay apart at a glance. */
function SourceBadge({ source }: { source: SlabRow["source"] }) {
  const tone = source === "LAB" ? "bg-info-bg text-info-fg" : source === "INWARD" ? "bg-accent-bg text-accent" : "bg-ok-bg text-ok-fg";
  return <span className={`badge whitespace-nowrap ${tone}`}>{SOURCE_LABEL[source]}</span>;
}

/** Results of the L, a, b search: nearest first, with the reading that matched. */
export function MeasurementResults({ rows, target }: { rows: SlabMatch[]; target: { l: number; a: number; b: number } }) {
  const off = (v: number, t: number) => {
    const d = v - t;
    return d === 0 ? "exact" : `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d).toFixed(2))}`;
  };
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[68rem] text-[14px]">
          <thead>
            <tr>
              <th className="th whitespace-normal">Slab Number</th>
              <th className="th whitespace-normal">Production Date</th>
              <th className="th whitespace-normal">Design Name</th>
              <th className="th whitespace-normal">Design Type</th>
              <th className="th whitespace-normal">Recorded In</th>
              <th className="th whitespace-normal">Body</th>
              <th className="th whitespace-normal">Stage</th>
              <th className="th text-right">L</th>
              <th className="th text-right">a</th>
              <th className="th text-right">b</th>
              <th className="th whitespace-normal">Difference</th>
              <th className="th">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.source}-${r.id}-${r.body}`} className="hover:bg-mute-bg/50">
                <td className="td font-semibold tabular-nums">
                  {dash(r.slabNumber)}
                  <span className="block text-[12px] font-normal text-ink-3">S.No. {r.serialNo}</span>
                </td>
                <td className="td whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="td">{dash(r.designName)}</td>
                <td className="td min-w-36">{dash(r.designType)}</td>
                <td className="td">
                  <SourceBadge source={r.source} />
                </td>
                <td className="td whitespace-nowrap">{r.body}</td>
                <td className="td whitespace-nowrap">{dash(r.stage)}</td>
                <td className="td text-right tabular-nums">
                  {formatNumber(r.l)}
                  <span className="block text-[12px] text-ink-3">{off(r.l, target.l)}</span>
                </td>
                <td className="td text-right tabular-nums">
                  {formatNumber(r.a)}
                  <span className="block text-[12px] text-ink-3">{off(r.a, target.a)}</span>
                </td>
                <td className="td text-right tabular-nums">
                  {formatNumber(r.b)}
                  <span className="block text-[12px] text-ink-3">{off(r.b, target.b)}</span>
                </td>
                <td className="td tabular-nums">
                  {i === 0 && <span className="badge mr-2 bg-ok-bg text-ok-fg">Nearest</span>}
                  {formatNumber(r.difference.toFixed(2))}
                </td>
                <td className="td">
                  <Review r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r, i) => (
          <li key={`${r.source}-${r.id}-${r.body}`} className="space-y-3 px-4 py-4">
            <div>
              <p className="text-[15px] font-bold">
                Slab {dash(r.slabNumber)}
                {i === 0 && <span className="badge ml-2 bg-ok-bg text-ok-fg">Nearest</span>}
              </p>
              <p className="text-[13px] text-ink-2">
                S.No. {r.serialNo} · {formatDate(r.date)}
              </p>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
              <dt className="text-ink-3">Design Name</dt>
              <dd>{dash(r.designName)}</dd>
              <dt className="text-ink-3">Design Type</dt>
              <dd>{dash(r.designType)}</dd>
              <dt className="text-ink-3">Recorded in</dt>
              <dd>
                <SourceBadge source={r.source} />
              </dd>
              <dt className="text-ink-3">Reading</dt>
              <dd>
                {r.body}
                {r.stage ? ` · ${r.stage}` : ""}
              </dd>
              <dt className="text-ink-3">L, a, b</dt>
              <dd className="tabular-nums">
                {formatNumber(r.l)}, {formatNumber(r.a)}, {formatNumber(r.b)}
                <span className="block text-[12px] text-ink-3">
                  {off(r.l, target.l)} · {off(r.a, target.a)} · {off(r.b, target.b)}
                </span>
              </dd>
            </dl>
            <Review r={r} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Results of the Production Date / Slab Number / Design Name search. */
export function ParameterResults({ rows }: { rows: SlabRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[60rem] text-[14px]">
          <thead>
            <tr>
              <th className="th whitespace-normal">Slab Number</th>
              <th className="th whitespace-normal">Production Date</th>
              <th className="th whitespace-normal">S.No.</th>
              <th className="th whitespace-normal">Design Name</th>
              <th className="th whitespace-normal">Design Type</th>
              <th className="th whitespace-normal">Number of Bodies</th>
              <th className="th whitespace-normal">Recorded In</th>
              <th className="th">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}-${r.id}`} className="hover:bg-mute-bg/50">
                <td className="td font-semibold tabular-nums">{dash(r.slabNumber)}</td>
                <td className="td whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="td tabular-nums">{r.serialNo}</td>
                <td className="td">{dash(r.designName)}</td>
                <td className="td min-w-36">{dash(r.designType)}</td>
                <td className="td tabular-nums">{dash(r.numberOfBodies)}</td>
                <td className="td">
                  <SourceBadge source={r.source} />
                </td>
                <td className="td">
                  <Review r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r) => (
          <li key={`${r.source}-${r.id}`} className="space-y-3 px-4 py-4">
            <div>
              <p className="text-[15px] font-bold">Slab {dash(r.slabNumber)}</p>
              <p className="text-[13px] text-ink-2">
                S.No. {r.serialNo} · {formatDate(r.date)}
              </p>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
              <dt className="text-ink-3">Design Name</dt>
              <dd>{dash(r.designName)}</dd>
              <dt className="text-ink-3">Design Type</dt>
              <dd>{dash(r.designType)}</dd>
              <dt className="text-ink-3">No. of Bodies</dt>
              <dd>{dash(r.numberOfBodies)}</dd>
              <dt className="text-ink-3">Recorded in</dt>
              <dd>
                <SourceBadge source={r.source} />
              </dd>
            </dl>
            <Review r={r} />
          </li>
        ))}
      </ul>
    </>
  );
}

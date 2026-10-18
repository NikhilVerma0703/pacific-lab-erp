import { FileSearch } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { FilteredRow } from "../filters";

const REVIEW: Record<FilteredRow["source"], string> = { LAB: "/samples", INWARD: "/inward-outward", PRODUCTION: "/production-sample" };
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

/**
 * The records a search found — the same table under Sample Data Download and
 * under Filtered Data Export, so both read alike and match their Excel.
 * Company Name only for the Inward / Outward report, which is the one that has it.
 */
export function RecordsTable({ rows, record }: { rows: FilteredRow[]; record: string }) {
  const company = rows.some((r) => r.source === "INWARD");
  const review = (r: FilteredRow) => (
    <Link href={`${REVIEW[r.source]}/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap" aria-label={`Review ${record} S.No. ${r.serialNo}`}>
      <FileSearch className="size-3.5" /> Review
    </Link>
  );
  const draft = (r: FilteredRow) => r.source === "LAB" && r.sample.status === "DRAFT";

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[60rem] text-[14px]">
          <thead>
            <tr>
              <th className="th whitespace-normal">S.No.</th>
              <th className="th whitespace-normal">Date</th>
              <th className="th whitespace-normal">Slab Number</th>
              <th className="th whitespace-normal">Sample Type</th>
              {company && <th className="th whitespace-normal">Company Name</th>}
              <th className="th whitespace-normal">Sample Design</th>
              <th className="th whitespace-normal">Design Type</th>
              <th className="th whitespace-normal">Number of Bodies</th>
              <th className="th">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.source}-${r.id}`} className="hover:bg-mute-bg/50">
                <td className="td font-semibold tabular-nums">
                  {r.serialNo}
                  {draft(r) && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                </td>
                <td className="td whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="td tabular-nums">{dash(r.slabNumber)}</td>
                <td className="td whitespace-nowrap">{record}</td>
                {company && <td className="td">{dash(r.company)}</td>}
                <td className="td">{dash(r.designName)}</td>
                <td className="td min-w-36">{dash(r.designTypes.join(", "))}</td>
                <td className="td tabular-nums">{dash(r.numberOfBodies)}</td>
                <td className="td">{review(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r) => (
          <li key={`${r.source}-${r.id}`} className="space-y-3 px-4 py-4">
            <div>
              <p className="text-[15px] font-bold">
                S.No. {r.serialNo}
                {draft(r) && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
              </p>
              <p className="text-[13px] text-ink-2">
                Slab {dash(r.slabNumber)} · {formatDate(r.date)}
              </p>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
              {company && (
                <>
                  <dt className="text-ink-3">Company</dt>
                  <dd>{dash(r.company)}</dd>
                </>
              )}
              <dt className="text-ink-3">Sample Design</dt>
              <dd>{dash(r.designName)}</dd>
              <dt className="text-ink-3">Design Type</dt>
              <dd>{dash(r.designTypes.join(", "))}</dd>
              <dt className="text-ink-3">No. of Bodies</dt>
              <dd>{dash(r.numberOfBodies)}</dd>
            </dl>
            {review(r)}
          </li>
        ))}
      </ul>
    </>
  );
}

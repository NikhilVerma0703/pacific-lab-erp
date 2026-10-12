import Link from "next/link";
import { FileSearch } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { RectificationRow } from "../queries";

/**
 * Lab samples saved with "Physical Sample Available? = No" — read-only while
 * the Lab Sample and Inward / Outward forms are being rebuilt; each opens its
 * Review page.
 */
export function RectificationList({ rows }: { rows: RectificationRow[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-ink-3">Nothing to rectify — every lab sample has its physical sample.</p>;
  }

  const review = (r: RectificationRow) => (
    <Link href={`/samples/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap" aria-label={`Review S.No. ${r.serialNo}`}>
      <FileSearch className="size-3.5" /> Review
    </Link>
  );
  const draft = (r: RectificationRow) => r.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <th className="th">S.No.</th>
              <th className="th">Lab S.No.</th>
              <th className="th">Slab Number</th>
              <th className="th">Date</th>
              <th className="th">Remarks</th>
              <th className="th">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-mute-bg/50">
                <td className="td tabular-nums text-ink-2">{i + 1}</td>
                <td className="td font-semibold tabular-nums">
                  {r.serialNo}
                  {draft(r)}
                </td>
                <td className="td tabular-nums">{r.slabNumber ?? "—"}</td>
                <td className="td whitespace-nowrap">{formatDate(r.sampleDate)}</td>
                <td className="td max-w-[280px]">
                  <span className="line-clamp-2">{r.remarks ?? "—"}</span>
                </td>
                <td className="td">{review(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r, i) => (
          <li key={r.id} className="space-y-2 px-4 py-4">
            <p className="text-[15px] font-bold">
              <span className="mr-2 font-normal text-ink-3">{i + 1}.</span>Lab S.No. {r.serialNo}
              {draft(r)}
            </p>
            <p className="text-[13px] text-ink-2">
              Slab {r.slabNumber ?? "—"} · {formatDate(r.sampleDate)}
            </p>
            {r.remarks && <p className="line-clamp-3 text-[14px]">{r.remarks}</p>}
            {review(r)}
          </li>
        ))}
      </ul>
    </>
  );
}

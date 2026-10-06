"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FileSearch, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { deleteSampleAction } from "@/modules/samples/actions";
import type { RectificationRow } from "../queries";

/**
 * Lab samples saved with "Physical Sample Available? = No".
 * "Sample received" opens the Inward / Outward form linked to the sample;
 * saving it moves the sample out of this list.
 */
export function RectificationList({
  rows,
  highlightId,
  canRecord,
  canEdit,
  canDelete,
}: {
  rows: RectificationRow[];
  /** The sample just saved with "No" in Sample Data Entry — marked in the list. */
  highlightId?: string;
  canRecord: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RectificationRow | null>(null);

  // Arriving from Sample Data Entry: bring the marked sample into view.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-sample-id="${CSS.escape(highlightId)}"]`)].find((e) => e.offsetParent !== null);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  function confirmDelete() {
    if (!target) return;
    const id = target.id;
    start(async () => {
      const r = await deleteSampleAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Deleted.");
        setTarget(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-ink-3">Nothing to rectify — every lab sample has its physical sample.</p>;
  }

  const buttons = (r: RectificationRow) => (
    <div className="flex flex-wrap gap-2">
      <Link href={`/samples/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap">
        <FileSearch className="size-3.5" /> Complete Details
      </Link>
      {canRecord && (
        <Link href={`/inward-outward?sample=${r.id}#entry`} className="btn btn-sm bg-accent text-white hover:bg-accent/90" scroll={false}>
          <PackageCheck className="size-3.5" /> Sample received
        </Link>
      )}
      {canEdit && (
        <Link href={`/samples/${r.id}/edit`} className="btn-secondary btn-sm">
          <Pencil className="size-3.5" /> Edit
        </Link>
      )}
      {canDelete && (
        <button type="button" className="btn btn-sm border border-bad-fg/30 bg-white text-bad-fg hover:bg-bad-bg" onClick={() => setTarget(r)}>
          <Trash2 className="size-3.5" /> Delete
        </button>
      )}
    </div>
  );

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
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                data-sample-id={r.id}
                aria-current={r.id === highlightId ? "true" : undefined}
                className={r.id === highlightId ? "bg-warn-bg/70 shadow-[inset_4px_0_0_var(--color-warn-fg)]" : "hover:bg-mute-bg/50"}
              >
                <td className="td tabular-nums text-ink-2">{i + 1}</td>
                <td className="td font-semibold tabular-nums">
                  {r.serialNo}
                  {r.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                  {r.id === highlightId && <JustMarked />}
                </td>
                <td className="td tabular-nums">{r.slabNumber ?? "—"}</td>
                <td className="td whitespace-nowrap">{formatDate(r.sampleDate)}</td>
                <td className="td max-w-[280px]"><span className="line-clamp-2">{r.remarks ?? "—"}</span></td>
                <td className="td">{buttons(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r, i) => (
          <li
            key={r.id}
            data-sample-id={r.id}
            aria-current={r.id === highlightId ? "true" : undefined}
            className={r.id === highlightId ? "space-y-2 bg-warn-bg/70 px-4 py-4 shadow-[inset_4px_0_0_var(--color-warn-fg)]" : "space-y-2 px-4 py-4"}
          >
            <p className="text-[15px] font-bold">
              <span className="mr-2 font-normal text-ink-3">{i + 1}.</span>Lab S.No. {r.serialNo}
              {r.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
              {r.id === highlightId && <JustMarked />}
            </p>
            <p className="text-[13px] text-ink-2">Slab {r.slabNumber ?? "—"} · {formatDate(r.sampleDate)}</p>
            {r.remarks && <p className="line-clamp-3 text-[14px]">{r.remarks}</p>}
            {buttons(r)}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!target}
        title="Delete entry"
        message={
          <>
            <p>Are you sure you want to delete this entry?</p>
            {target && <p className="mt-2 text-sm">Lab sample S.No. {target.serialNo} will be removed permanently.</p>}
          </>
        }
        busy={pending}
        onCancel={() => setTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function JustMarked() {
  return <span className="badge ml-2 border border-warn-fg/40 bg-white text-warn-fg">Awaiting physical sample · just saved</span>;
}

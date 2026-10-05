"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileSearch, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { deleteSampleAction } from "../actions";
import type { RecentRow } from "../queries";

/** The register under the form: last 10 saved samples. */
export function RecentEntries({ rows, canEdit, canDelete }: { rows: RecentRow[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RecentRow | null>(null);

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

  const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

  const actions = (r: RecentRow) => (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Link href={`/samples/${r.id}/edit`} className="btn-secondary btn-sm">
          <Pencil className="size-3.5" /> Edit
        </Link>
      )}
      {canDelete && (
        <button type="button" className="btn-sm btn border border-bad-fg/30 bg-white text-bad-fg hover:bg-bad-bg" onClick={() => setTarget(r)}>
          <Trash2 className="size-3.5" /> Delete
        </button>
      )}
    </div>
  );

  const details = (r: RecentRow) => (
    <Link href={`/samples/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap">
      <FileSearch className="size-3.5" /> Complete Details
    </Link>
  );

  return (
    <section className="card mt-8" aria-labelledby="recent-heading">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 id="recent-heading" className="text-[15px] font-bold">Recent Entries</h2>
          <p className="text-[13px] text-ink-2">The last 10 saved samples</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">No samples saved yet.</p>
      ) : (
        <>
          {/* Desktop / landscape tablet: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th">S.No.</th>
                  <th className="th">Slab Number</th>
                  <th className="th">Date</th>
                  <th className="th">Design</th>
                  <th className="th">Mixer Type</th>
                  <th className="th">Vein</th>
                  <th className="th">Complete Details</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-mute-bg/50">
                    <td className="td font-semibold tabular-nums">
                      {r.serialNo}
                      {r.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                    </td>
                    <td className="td tabular-nums">{dash(r.slabNumber)}</td>
                    <td className="td whitespace-nowrap">{formatDate(r.sampleDate)}</td>
                    <td className="td">{dash(r.design)}</td>
                    <td className="td">{dash(r.mixerType)}</td>
                    <td className="td">{dash(r.vein)}</td>
                    <td className="td">{details(r)}</td>
                    <td className="td">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone / portrait tablet: cards */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold">
                      S.No. {r.serialNo}
                      {r.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                    </p>
                    <p className="text-[13px] text-ink-2">
                      Slab {dash(r.slabNumber)} · {formatDate(r.sampleDate)}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1 text-[14px]">
                  <dt className="text-ink-3">Design</dt>
                  <dd>{dash(r.design)}</dd>
                  <dt className="text-ink-3">Mixer Type</dt>
                  <dd>{dash(r.mixerType)}</dd>
                  <dt className="text-ink-3">Vein</dt>
                  <dd>{dash(r.vein)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {details(r)}
                  {actions(r)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete entry"
        message={
          <>
            <p>Are you sure you want to delete this entry?</p>
            {target && (
              <p className="mt-2 text-sm">
                S.No. {target.serialNo}
                {target.slabNumber ? ` · Slab ${target.slabNumber}` : ""} will be removed permanently, with its formulation,
                measurements and files.
              </p>
            )}
          </>
        }
        confirmLabel="Delete"
        busy={pending}
        onCancel={() => setTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

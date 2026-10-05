"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileSearch, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { deleteInwardAction } from "../actions";
import type { InwardRow } from "../queries";

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

export function InwardRecentEntries({ rows, canEdit, canDelete }: { rows: InwardRow[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<InwardRow | null>(null);

  function confirmDelete() {
    if (!target) return;
    const id = target.id;
    start(async () => {
      const r = await deleteInwardAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Deleted.");
        setTarget(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const details = (r: InwardRow) => (
    <Link href={`/inward-outward/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap">
      <FileSearch className="size-3.5" /> Complete Details
    </Link>
  );
  const actions = (r: InwardRow) => (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Link href={`/inward-outward/${r.id}/edit`} className="btn-secondary btn-sm">
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
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">No inward / outward entries yet.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th">S.No.</th>
                  <th className="th">Serial Number</th>
                  <th className="th">Company Name</th>
                  <th className="th">Sample Design Name</th>
                  <th className="th">Design Pattern</th>
                  <th className="th">Lab Recreation Attempts</th>
                  <th className="th">Complete Details</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-mute-bg/50">
                    <td className="td tabular-nums text-ink-2">{i + 1}</td>
                    <td className="td font-semibold tabular-nums">
                      {r.serialNo}
                      <span className="block text-[12px] font-normal text-ink-3">{formatDate(r.entryDate)}</span>
                      {r.labSampleSerial !== null && (
                        <span className="block text-[12px] font-normal text-ink-3">Lab S.No. {r.labSampleSerial}</span>
                      )}
                    </td>
                    <td className="td">{dash(r.company)}</td>
                    <td className="td">{dash(r.sampleDesignName)}</td>
                    <td className="td">{dash(r.design)}</td>
                    <td className="td max-w-[280px]">
                      <span className="line-clamp-2" title={r.recreationAttempts ?? undefined}>{dash(r.recreationAttempts)}</span>
                    </td>
                    <td className="td">{details(r)}</td>
                    <td className="td">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r, i) => (
              <li key={r.id} className="space-y-3 px-4 py-4">
                <p className="text-[15px] font-bold">
                  <span className="mr-2 font-normal text-ink-3">{i + 1}.</span>Serial No. {r.serialNo}
                  <span className="ml-2 text-[12px] font-normal text-ink-3">{formatDate(r.entryDate)}</span>
                  {r.labSampleSerial !== null && <span className="ml-2 text-[12px] font-normal text-ink-3">Lab S.No. {r.labSampleSerial}</span>}
                </p>
                <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-[14px]">
                  <dt className="text-ink-3">Company</dt>
                  <dd>{dash(r.company)}</dd>
                  <dt className="text-ink-3">Design Name</dt>
                  <dd>{dash(r.sampleDesignName)}</dd>
                  <dt className="text-ink-3">Design Pattern</dt>
                  <dd>{dash(r.design)}</dd>
                  <dt className="text-ink-3">Recreation</dt>
                  <dd className="line-clamp-3">{dash(r.recreationAttempts)}</dd>
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
            {target && <p className="mt-2 text-sm">Serial No. {target.serialNo} will be removed permanently.</p>}
          </>
        }
        busy={pending}
        onCancel={() => setTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

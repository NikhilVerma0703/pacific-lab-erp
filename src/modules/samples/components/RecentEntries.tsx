"use client";

import { ChevronLeft, ChevronRight, FileSearch, Paperclip, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { deleteLabSampleAction } from "../actions";
import type { RecentRow } from "../queries";

/**
 * Recent Entries under the Lab Sample form: every saved sample, newest
 * first, 15 per page — Date, S.No., Slab Number, Design Name, Design Type, Number
 * of Bodies, Remarks (+ files), Review, Edit / Delete.
 */
export function RecentEntries({
  rows,
  total,
  page,
  pages,
  pageSize,
  canEdit,
  canDelete,
}: {
  rows: RecentRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RecentRow | null>(null);
  // Hide a deleted row at once; the refreshed list follows.
  const [gone, setGone] = useState<string[]>([]);
  const visible = rows.filter((r) => !gone.includes(r.id));

  function confirmDelete() {
    if (!target) return;
    const id = target.id;
    start(async () => {
      const r = await deleteLabSampleAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Deleted.");
        setGone((g) => [...g, id]);
        setTarget(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

  const review = (r: RecentRow) => (
    <Link href={`/samples/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap" aria-label={`Review S.No. ${r.serialNo}`}>
      <FileSearch className="size-3.5" /> Review
    </Link>
  );

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

  const draft = (r: RecentRow) => (r.status === "DRAFT" ? <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span> : null);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <section id="recent" className="card mt-8 scroll-mt-20" aria-labelledby="recent-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 id="recent-heading" className="text-[15px] font-bold">
            Recent Entries
          </h2>
          <p className="text-[13px] text-ink-2">{total === 0 ? "No samples yet" : `${total} ${total === 1 ? "sample" : "samples"}, newest first`}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">No samples saved yet.</p>
      ) : (
        <>
          {/* The table scrolls sideways on a tablet — nothing is left out. */}
          <p className="hidden border-b border-line px-4 pb-2 text-[12px] text-ink-3 sm:block lg:hidden sm:px-5">Scroll the table sideways to see every column.</p>
          {/* Tablet and desktop: the complete table, scrolling sideways when it does not fit */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[64rem] text-[14px]">
              <thead>
                <tr>
                  <th className="th whitespace-normal">Date</th>
                  <th className="th whitespace-normal">S.No.</th>
                  <th className="th whitespace-normal">Slab Number</th>
                  <th className="th whitespace-normal">Design Name</th>
                  <th className="th whitespace-normal">Design Type</th>
                  <th className="th whitespace-normal">Number of Bodies</th>
                  <th className="th whitespace-normal">Remarks</th>
                  <th className="th">Review</th>
                  <th className="th whitespace-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-mute-bg/50" data-row-id={r.id}>
                    <td className="td whitespace-nowrap">{formatDate(r.sampleDate)}</td>
                    <td className="td font-semibold tabular-nums">
                      {r.serialNo}
                      {draft(r)}
                    </td>
                    <td className="td tabular-nums">{dash(r.slabNumber)}</td>
                    <td className="td">{dash(r.designName)}</td>
                    <td className="td min-w-36">{dash(r.design)}</td>
                    <td className="td tabular-nums">{dash(r.numberOfBodies)}</td>
                    <td className="td max-w-64 min-w-36">
                      {r.remarks ? (
                        <p className="line-clamp-3 text-[13px] text-ink-2" title={r.remarks}>
                          {r.remarks}
                        </p>
                      ) : (
                        "—"
                      )}
                      {r.files > 0 && <FilesBadge n={r.files} />}
                    </td>
                    <td className="td">{review(r)}</td>
                    <td className="td">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: the same fields as cards */}
          <ul className="divide-y divide-line sm:hidden">
            {visible.map((r) => (
              <li key={r.id} className="space-y-3 px-4 py-4" data-row-id={r.id}>
                <div>
                  <p className="text-[15px] font-bold">
                    S.No. {r.serialNo}
                    {r.designName && <span className="font-semibold text-ink-2"> · {r.designName}</span>}
                    {draft(r)}
                  </p>
                  <p className="text-[13px] text-ink-2">
                    Slab {dash(r.slabNumber)} · {formatDate(r.sampleDate)}
                  </p>
                </div>
                <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
                  <dt className="text-ink-3">Design Type</dt>
                  <dd>{dash(r.design)}</dd>
                  <dt className="text-ink-3">No. of Bodies</dt>
                  <dd>{dash(r.numberOfBodies)}</dd>
                  <dt className="text-ink-3">Remarks</dt>
                  <dd className="min-w-0">
                    <span className="line-clamp-3 break-words">{dash(r.remarks)}</span>
                    {r.files > 0 && <FilesBadge n={r.files} />}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {review(r)}
                  {actions(r)}
                </div>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Recent Entries pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-2 sm:px-5">
              <span>
                Showing {first}–{last} of {total}
              </span>
              <span className="flex gap-2">
                <PageLink page={page - 1} disabled={page <= 1}>
                  <ChevronLeft className="size-4" /> Newer
                </PageLink>
                <PageLink page={page + 1} disabled={page >= pages}>
                  Older <ChevronRight className="size-4" />
                </PageLink>
              </span>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!target}
        title="Delete sample"
        message={
          <>
            <p>Are you sure you want to delete this sample?</p>
            {target && (
              <p className="mt-2 text-sm">
                Lab Sample S.No. {target.serialNo}
                {target.slabNumber ? ` · Slab ${target.slabNumber}` : ""} will be removed permanently, with its materials, readings and files.
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

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="btn-secondary btn-sm pointer-events-none opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={`/samples?page=${page}#recent`} className="btn-secondary btn-sm" scroll={false}>
      {children}
    </Link>
  );
}

function FilesBadge({ n }: { n: number }) {
  return (
    <span className="badge mt-1 gap-1 bg-mute-bg text-ink-2">
      <Paperclip className="size-3" /> {n} {n === 1 ? "file" : "files"}
    </span>
  );
}

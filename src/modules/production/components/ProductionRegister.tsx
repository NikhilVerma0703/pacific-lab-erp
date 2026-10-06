"use client";

import { ChevronLeft, ChevronRight, FileSearch, Paperclip, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { deleteProductionAction } from "../actions";
import type { RegisterRow } from "../queries";

/** The Production Sample Register under the form: every saved entry, newest first, 20 per page. */
export function ProductionRegister({
  rows,
  total,
  page,
  pages,
  pageSize,
  canEdit,
  canDelete,
}: {
  rows: RegisterRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RegisterRow | null>(null);
  // Hide a deleted row at once; the refreshed register follows.
  const [gone, setGone] = useState<string[]>([]);
  const visible = rows.filter((r) => !gone.includes(r.id));

  function confirmDelete() {
    if (!target) return;
    const id = target.id;
    start(async () => {
      const r = await deleteProductionAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Deleted.");
        setGone((g) => [...g, id]);
        setTarget(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

  const details = (r: RegisterRow) => (
    <Link href={`/production-sample/${r.id}`} className="btn-secondary btn-sm whitespace-nowrap">
      <FileSearch className="size-3.5" /> Complete Details
    </Link>
  );

  const actions = (r: RegisterRow) => (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Link href={`/production-sample/${r.id}/edit`} className="btn-secondary btn-sm">
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

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <section id="register" className="card mt-8 scroll-mt-20" aria-labelledby="register-h">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 id="register-h" className="text-[15px] font-bold">
            Production Sample Register
          </h2>
          <p className="text-[13px] text-ink-2">
            {total === 0 ? "No entries yet" : `${total} ${total === 1 ? "entry" : "entries"}, newest first`}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">No production samples saved yet.</p>
      ) : (
        <>
          {/* Desktop / landscape tablet: table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th whitespace-normal">Date</th>
                  <th className="th whitespace-normal">S. No.</th>
                  <th className="th whitespace-normal">Slab Number</th>
                  <th className="th whitespace-normal">Design Name</th>
                  <th className="th whitespace-normal">Number of Bodies</th>
                  <th className="th whitespace-normal">Design / Design Pattern</th>
                  <th className="th whitespace-normal">L, a, b Details</th>
                  <th className="th whitespace-normal">Remarks</th>
                  <th className="th whitespace-normal">Complete Details</th>
                  <th className="th whitespace-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-mute-bg/50" data-row-id={r.id}>
                    <td className="td whitespace-nowrap">{formatDate(r.sampleDate)}</td>
                    <td className="td font-semibold tabular-nums">{r.serialNo}</td>
                    <td className="td tabular-nums">{dash(r.slabNumber)}</td>
                    <td className="td">{dash(r.designName)}</td>
                    <td className="td tabular-nums">{dash(r.numberOfBodies)}</td>
                    <td className="td min-w-40">{dash(r.design)}</td>
                    <td className="td">
                      <LabSummary row={r} />
                    </td>
                    <td className="td min-w-36 max-w-64">
                      {r.remarks ? (
                        <p className="line-clamp-3 text-[13px] text-ink-2" title={r.remarks}>
                          {r.remarks}
                        </p>
                      ) : (
                        "—"
                      )}
                      {r.files > 0 && <FilesBadge n={r.files} />}
                    </td>
                    <td className="td">{details(r)}</td>
                    <td className="td">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone / portrait tablet: cards */}
          <ul className="divide-y divide-line lg:hidden">
            {visible.map((r) => (
              <li key={r.id} className="space-y-3 px-4 py-4" data-row-id={r.id}>
                <div>
                  <p className="text-[15px] font-bold">
                    S. No. {r.serialNo}
                    {r.designName && <span className="font-semibold text-ink-2"> · {r.designName}</span>}
                  </p>
                  <p className="text-[13px] text-ink-2">
                    Slab {dash(r.slabNumber)} · {formatDate(r.sampleDate)}
                  </p>
                </div>
                <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px]">
                  <dt className="text-ink-3">No. of Bodies</dt>
                  <dd>{dash(r.numberOfBodies)}</dd>
                  <dt className="text-ink-3">Design</dt>
                  <dd>{dash(r.design)}</dd>
                  <dt className="text-ink-3">L, a, b</dt>
                  <dd className="min-w-0 overflow-x-auto">
                    <LabSummary row={r} />
                  </dd>
                  <dt className="text-ink-3">Remarks</dt>
                  <dd className="min-w-0">
                    <span className="line-clamp-3 break-words">{dash(r.remarks)}</span>
                    {r.files > 0 && <FilesBadge n={r.files} />}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {details(r)}
                  {actions(r)}
                </div>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Register pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-2 sm:px-5">
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
        title="Delete entry"
        message={
          <>
            <p>Are you sure you want to delete this entry?</p>
            {target && (
              <p className="mt-2 text-sm">
                Production sample S. No. {target.serialNo}
                {target.slabNumber ? ` · Slab ${target.slabNumber}` : ""} will be removed permanently, with its readings and files.
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
    <Link href={`/production-sample?page=${page}#register`} className="btn-secondary btn-sm" scroll={false}>
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

const STAGE_SHORT = { POST_PRESS: "Press", POST_POLISH: "Polish" } as const;

type Line = { key: string; label: string; tone: "brand" | "accent"; v: { l: string | null; a: string | null; b: string | null } };

/**
 * Compact L/a/b for the register, body by body: "B1 · Press", "B1 · Polish",
 * then that body's Roy Body readings ("B1 Roy · Press · R1").
 */
function LabSummary({ row }: { row: RegisterRow }) {
  const lines: Line[] = [];
  for (const b of row.bodies) {
    if (b.postPress) lines.push({ key: `${b.index}-pp`, label: `B${b.index} · Press`, tone: "brand", v: b.postPress });
    if (b.postPolish) lines.push({ key: `${b.index}-pl`, label: `B${b.index} · Polish`, tone: "brand", v: b.postPolish });
    for (const m of b.royBody?.readings ?? [])
      lines.push({ key: `${b.index}-r-${m.stage}-${m.bodyIndex}`, label: `B${b.index} Roy · ${STAGE_SHORT[m.stage]} · R${m.bodyIndex}`, tone: "accent", v: m });
  }
  if (!lines.length) return <span className="text-ink-3">—</span>;
  return (
    <table className="text-[12px] tabular-nums">
      <thead>
        <tr className="text-ink-3">
          <th className="pr-2 text-left font-semibold" />
          <th className="px-1.5 text-right font-semibold">L</th>
          <th className="px-1.5 text-right font-semibold">a</th>
          <th className="pl-1.5 text-right font-semibold">b</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((x) => (
          <tr key={x.key}>
            <td className={cn("pr-2 whitespace-nowrap", x.tone === "brand" ? "text-brand" : "text-accent")}>{x.label}</td>
            <td className="px-1.5 text-right">{formatNumber(x.v.l)}</td>
            <td className="px-1.5 text-right">{formatNumber(x.v.a)}</td>
            <td className="pl-1.5 text-right">{formatNumber(x.v.b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

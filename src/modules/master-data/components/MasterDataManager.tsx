"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { normalizeKey } from "@/lib/normalize";
import {
  createMasterValue,
  moveMasterValue,
  renameMasterValue,
  setMasterValueActive,
} from "../actions";
import type { MasterValueRow } from "../service";
import { ConfirmDialog } from "@/components/ui/Dialog";

interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  total: number;
  active: number;
}

type StatusFilter = "active" | "disabled" | "all";

const CODE_HINT: Record<string, string> = {
  ROY_BODY: "Opens the Roy Body formulation",
};

export function MasterDataManager({
  categories,
  selectedCode,
  category,
  values,
  canManage,
}: {
  categories: Category[];
  selectedCode: string;
  category: { id: string; code: string; name: string; description: string | null };
  values: MasterValueRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  // Phones: the lists are a sideways strip — keep the open list in view.
  const listsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = listsRef.current;
    const active = strip?.querySelector<HTMLElement>("[aria-current=page]");
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
    const a = active.getBoundingClientRect();
    const box = strip.getBoundingClientRect();
    strip.scrollLeft += a.left - box.left - (box.width - a.width) / 2;
  }, [selectedCode]);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [newLabel, setNewLabel] = useState("");
  const [newError, setNewError] = useState<string>();
  const [editing, setEditing] = useState<{ id: string; label: string; error?: string } | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<MasterValueRow | null>(null);

  const shown = useMemo(() => {
    const q = normalizeKey(query);
    return values.filter(
      (v) =>
        (status === "all" || (status === "active" ? v.isActive : !v.isActive)) &&
        (!q || normalizeKey(v.label).includes(q)),
    );
  }, [values, query, status]);

  const activeIds = values.filter((v) => v.isActive).map((v) => v.id);
  const possibleDuplicate =
    newLabel.trim() && values.find((v) => normalizeKey(v.label) === normalizeKey(newLabel));

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }>, after?: (r: { ok: boolean; fieldErrors?: Record<string, string>; error?: string }) => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.error ?? "Could not save.");
      }
      after?.(r);
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return setNewError("Enter a value.");
    run(
      () => createMasterValue({ categoryId: category.id, label: newLabel }),
      (r) => {
        if (r.ok) {
          setNewLabel("");
          setNewError(undefined);
        } else setNewError(r.fieldErrors?.label ?? r.error);
      },
    );
  }

  function saveRename() {
    if (!editing) return;
    const id = editing.id;
    run(
      () => renameMasterValue({ id, label: editing.label }),
      (r) => {
        if (r.ok) setEditing(null);
        else setEditing((ed) => (ed ? { ...ed, error: r.fieldErrors?.label ?? r.error } : ed));
      },
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* Lists */}
      <nav aria-label="Master lists" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div ref={listsRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {categories.map((c) => {
            const active = c.code === selectedCode;
            return (
              <Link
                key={c.id}
                href={`/master-data?list=${c.code}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-[14px] font-medium whitespace-nowrap lg:whitespace-normal",
                  active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-line-2",
                )}
              >
                <span className="flex-1">{c.name}</span>
                <span className={cn("badge", active ? "bg-white/20 text-white" : "bg-mute-bg text-mute-fg")}>
                  {c.active}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Values */}
      <section className="card min-w-0">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold">{category.name}</h2>
          {category.description && <p className="text-sm text-ink-2">{category.description}</p>}
        </div>

        {canManage && (
          <form onSubmit={add} className="border-b border-line bg-mute-bg/50 px-4 py-4 sm:px-5">
            <label className="label" htmlFor="new-value">Add a value</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="new-value"
                className={cn("input", newError && "input-error")}
                placeholder={`New ${category.name.toLowerCase().replace(/s$/, "")}`}
                value={newLabel}
                maxLength={80}
                onChange={(e) => {
                  setNewLabel(e.target.value);
                  setNewError(undefined);
                }}
              />
              <button className="btn-primary shrink-0" disabled={pending}>
                <Plus className="size-4" /> Add
              </button>
            </div>
            {newError ? (
              <p className="mt-1 text-[13px] text-bad-fg">{newError}</p>
            ) : possibleDuplicate ? (
              <p className="mt-1 text-[13px] text-warn-fg">
                “{possibleDuplicate.label}” already exists{possibleDuplicate.isActive ? "" : " (disabled)"}.
              </p>
            ) : null}
          </form>
        )}

        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              className="input pl-9"
              placeholder="Search this list"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search values"
            />
          </div>
          <div className="flex rounded-lg border border-line-2 bg-white p-0.5" role="radiogroup" aria-label="Status">
            {(["active", "disabled", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  "min-h-10 flex-1 rounded-md px-3 text-[13px] font-semibold capitalize",
                  status === s ? "bg-brand text-white" : "text-ink-2 hover:bg-mute-bg",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-line border-t border-line">
          {shown.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-ink-3">
              {values.length === 0 ? "This list is empty." : "Nothing matches."}
            </li>
          )}
          {shown.map((v) => {
            const pos = activeIds.indexOf(v.id);
            const isEditing = editing?.id === v.id;
            return (
              <li key={v.id} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5", !v.isActive && "bg-mute-bg/60")}>
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div>
                      <div className="flex gap-2">
                        <input
                          className={cn("input", editing.error && "input-error")}
                          value={editing.label}
                          autoFocus
                          maxLength={80}
                          aria-label="Value name"
                          onChange={(e) => setEditing({ ...editing, label: e.target.value, error: undefined })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <button type="button" className="btn-primary shrink-0 px-3" onClick={saveRename} disabled={pending} aria-label="Save">
                          <Check className="size-4" />
                        </button>
                        <button type="button" className="btn-secondary shrink-0 px-3" onClick={() => setEditing(null)} aria-label="Cancel">
                          <X className="size-4" />
                        </button>
                      </div>
                      {editing.error && <p className="mt-1 text-[13px] text-bad-fg">{editing.error}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[15px] font-semibold", !v.isActive && "text-ink-3 line-through")}>{v.label}</span>
                        {!v.isActive && <span className="badge bg-mute-bg text-mute-fg">Disabled</span>}
                        {v.isSystem && <span className="badge bg-info-bg text-info-fg">Standard</span>}
                        {v.code && CODE_HINT[v.code] && <span className="badge bg-accent-bg text-accent">{CODE_HINT[v.code]}</span>}
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink-3">
                        Used {v.usage} {v.usage === 1 ? "time" : "times"}
                        {v.createdBy ? ` · added by ${v.createdBy}` : ""} · {formatDate(v.createdAt)}
                      </p>
                    </>
                  )}
                </div>
                {canManage && !isEditing && (
                  <div className="flex shrink-0 items-center gap-1">
                    {v.isActive && (
                      <>
                        <button type="button" className="icon-btn" aria-label="Move up" disabled={pending || pos <= 0}
                          onClick={() => run(() => moveMasterValue({ id: v.id, direction: "up" }))}>
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" className="icon-btn" aria-label="Move down" disabled={pending || pos === activeIds.length - 1}
                          onClick={() => run(() => moveMasterValue({ id: v.id, direction: "down" }))}>
                          <ArrowDown className="size-4" />
                        </button>
                      </>
                    )}
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing({ id: v.id, label: v.label })}>
                      <Pencil className="size-3.5" /> Edit
                    </button>
                    {v.isActive ? (
                      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => setConfirmDisable(v)}>
                        <EyeOff className="size-3.5" /> Disable
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary btn-sm" disabled={pending}
                        onClick={() => run(() => setMasterValueActive({ id: v.id, isActive: true }))}>
                        <Eye className="size-3.5" /> Reactivate
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <ConfirmDialog
        open={!!confirmDisable}
        title="Disable this value?"
        tone="primary"
        confirmLabel="Disable"
        busy={pending}
        message={
          <>
            <p>
              “{confirmDisable?.label}” will no longer appear in dropdowns for new entries.
            </p>
            {confirmDisable && confirmDisable.usage > 0 && (
              <p className="mt-2">
                It is used {confirmDisable.usage} {confirmDisable.usage === 1 ? "time" : "times"}; those samples keep it. You can reactivate it any time.
              </p>
            )}
          </>
        }
        onCancel={() => setConfirmDisable(null)}
        onConfirm={() => {
          const v = confirmDisable!;
          run(() => setMasterValueActive({ id: v.id, isActive: false }), () => setConfirmDisable(null));
        }}
      />
    </div>
  );
}

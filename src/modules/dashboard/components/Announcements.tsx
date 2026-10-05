"use client";

import { Megaphone, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { cn, formatDateTime } from "@/lib/utils";
import { archiveAnnouncementAction, saveAnnouncementAction, type AnnouncementInput } from "../actions";
import type { AnnouncementDTO } from "../announcements";
import { ANNOUNCEMENT_KIND_LABEL, ANNOUNCEMENT_KIND_VALUES, type AnnouncementKindValue } from "../kinds";

const KIND_STYLE: Record<AnnouncementKindValue, string> = {
  ANNOUNCEMENT: "bg-info-bg text-info-fg",
  TASK: "bg-accent-bg text-accent",
  INSTRUCTION: "bg-mute-bg text-ink-2",
  QUERY: "bg-warn-bg text-warn-fg",
  PRODUCTION: "bg-[#eef0fb] text-[#3b3fa0]",
  OTHER: "bg-mute-bg text-mute-fg",
};

const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 3600_000;

export function Announcements({
  items,
  canPublish,
  userId,
  isAdmin,
}: {
  items: AnnouncementDTO[];
  canPublish: boolean;
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ id?: string; values: AnnouncementInput } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<AnnouncementDTO | null>(null);

  const blank: AnnouncementInput = { kind: "ANNOUNCEMENT", title: "", message: "", important: false };
  const canChange = (a: AnnouncementDTO) => canPublish && (a.createdById === userId || isAdmin);

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveAnnouncementAction(editing.values, editing.id);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Saved.");
      setEditing(null);
      setErrors({});
      router.refresh();
    });
  }

  function archive() {
    if (!removing) return;
    const id = removing.id;
    start(async () => {
      const r = await archiveAnnouncementAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Removed.");
        setRemoving(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const [featured, ...rest] = items;

  return (
    <section id="announcements" className="scroll-mt-20" aria-labelledby="ann-h">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="ann-h" className="flex items-center gap-2 text-[13px] font-bold tracking-widest text-ink-2 uppercase">
          <Megaphone className="size-4" /> Request / Announcement
        </h2>
        <span className="flex-1" />
        {canPublish && (
          <button type="button" className="btn-primary" onClick={() => (setErrors({}), setEditing({ values: blank }))}>
            <Plus className="size-4" /> New announcement
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card px-5 py-10 text-center text-sm text-ink-3">
          No announcements yet.{canPublish ? " Publish one for the team with “New announcement”." : ""}
        </div>
      ) : (
        <div className="space-y-3">
          <Card a={featured} featured onEdit={canChange(featured) ? () => edit(featured) : undefined} onRemove={canChange(featured) ? () => setRemoving(featured) : undefined} />
          {rest.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {rest.map((a) => (
                <Card key={a.id} a={a} onEdit={canChange(a) ? () => edit(a) : undefined} onRemove={canChange(a) ? () => setRemoving(a) : undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit announcement" : "New announcement"}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={pending}>
              <Megaphone className="size-4" /> {pending ? "Publishing…" : editing?.id ? "Save" : "Publish"}
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Type" htmlFor="ann-kind">
              <select
                id="ann-kind"
                className="input"
                value={editing.values.kind}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, kind: e.target.value } })}
              >
                {ANNOUNCEMENT_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {ANNOUNCEMENT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" htmlFor="ann-title" error={errors.title}>
              <input
                id="ann-title"
                className={cn("input", errors.title && "input-error")}
                maxLength={150}
                value={editing.values.title}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, title: e.target.value } })}
              />
            </Field>
            <Field label="Message" htmlFor="ann-message" error={errors.message}>
              <textarea
                id="ann-message"
                rows={6}
                className={cn("input", errors.message && "input-error")}
                maxLength={4000}
                value={editing.values.message}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, message: e.target.value } })}
              />
            </Field>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-brand)]"
                checked={editing.values.important}
                onChange={(e) => setEditing({ ...editing, values: { ...editing.values, important: e.target.checked } })}
              />
              Mark as important (pinned to the top)
            </label>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        title="Remove announcement?"
        message={<p>“{removing?.title}” will no longer be shown on the dashboard. It stays in the records.</p>}
        confirmLabel="Remove"
        busy={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={archive}
      />
    </section>
  );

  function edit(a: AnnouncementDTO) {
    setErrors({});
    setEditing({ id: a.id, values: { kind: a.kind, title: a.title, message: a.message, important: a.important } });
  }
}

function Card({ a, featured, onEdit, onRemove }: { a: AnnouncementDTO; featured?: boolean; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <article
      className={cn(
        "card relative flex flex-col gap-2 p-4 sm:p-5",
        a.important && "border-l-4 border-l-bad-fg",
        featured && "bg-gradient-to-br from-white to-info-bg/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("badge", KIND_STYLE[a.kind])}>{ANNOUNCEMENT_KIND_LABEL[a.kind]}</span>
        {a.important && (
          <span className="badge gap-1 bg-bad-bg text-bad-fg">
            <Star className="size-3 fill-current" /> Important
          </span>
        )}
        {isNew(a.createdAt) && <span className="badge bg-ok-bg text-ok-fg">New</span>}
        <span className="flex-1" />
        {onEdit && (
          <button type="button" className="icon-btn size-9" onClick={onEdit} aria-label={`Edit ${a.title}`}>
            <Pencil className="size-4" />
          </button>
        )}
        {onRemove && (
          <button type="button" className="icon-btn size-9 text-bad-fg" onClick={onRemove} aria-label={`Remove ${a.title}`}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <h3 className={cn("font-bold tracking-tight", featured ? "text-xl" : "text-[16px]")}>{a.title}</h3>
      <p className={cn("whitespace-pre-wrap text-ink-2", featured ? "text-[15px]" : "line-clamp-6 text-[14px]")}>{a.message}</p>
      <p className="mt-auto pt-2 text-[12px] text-ink-3">
        <span className="font-semibold text-ink-2">{a.createdBy ?? "—"}</span> · {formatDateTime(a.createdAt)}
        {a.updatedAt !== a.createdAt && new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime() > 60_000 && " · edited"}
      </p>
    </article>
  );
}

"use client";

import { MessagesSquare, Plus, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";
import { archiveForumPostAction, deleteForumReplyAction, saveForumPostAction } from "../actions";
import {
  POST_KIND_LABEL,
  POST_KIND_VALUES,
  POST_PRIORITY_LABEL,
  POST_STATUS_LABEL,
  POST_STATUS_VALUES,
  type PostStatus,
} from "../kinds";
import type { ForumPostDTO, ForumReplyDTO } from "../queries";
import { emptyPost, type PostInput } from "../schema";
import { PostCard } from "./PostCard";
import { useForumName } from "./forum-ui";

type Filter = "ALL" | PostStatus;

/**
 * Forum: instructions, tasks, queries and announcements from the Lab Head /
 * Plant Head / CEO, each with its own reply thread for Lab and R&D users.
 */
export function Forum({
  posts,
  userId,
  isAdmin,
  canPost,
  canReply,
  canStatus,
}: {
  posts: ForumPostDTO[];
  userId: string;
  isAdmin: boolean;
  canPost: boolean;
  canReply: boolean;
  canStatus: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, rememberName] = useForumName();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<{ id?: string; values: PostInput } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<ForumPostDTO | null>(null);
  const [removingReply, setRemovingReply] = useState<ForumReplyDTO | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: posts.length, OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    for (const p of posts) c[p.status]++;
    return c;
  }, [posts]);
  const visible = filter === "ALL" ? posts : posts.filter((p) => p.status === filter);

  const owns = (createdById: string | null) => createdById === userId || isAdmin;

  function openNew() {
    setErrors({});
    setEditing({ values: emptyPost(name) });
  }

  function openEdit(p: ForumPostDTO) {
    setErrors({});
    setEditing({
      id: p.id,
      values: { kind: p.kind, title: p.title, message: p.message, important: p.important, status: p.status, authorName: p.author === "—" ? "" : p.author },
    });
  }

  function set<K extends keyof PostInput>(k: K, v: PostInput[K]) {
    if (!editing) return;
    setEditing({ ...editing, values: { ...editing.values, [k]: v } });
    if (errors[k]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveForumPostAction(editing.values, editing.id);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      if (!editing.id) rememberName(editing.values.authorName);
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
      const r = await archiveForumPostAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Removed.");
        setRemoving(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function removeReply() {
    if (!removingReply) return;
    const id = removingReply.id;
    start(async () => {
      const r = await deleteForumReplyAction(id);
      if (r.ok) {
        toast.success(r.message ?? "Removed.");
        setRemovingReply(null);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "ALL", label: "All" },
    ...POST_STATUS_VALUES.map((s) => ({ value: s as Filter, label: POST_STATUS_LABEL[s] })),
  ];

  return (
    <section id="forum" className="scroll-mt-20" aria-labelledby="forum-h">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="forum-h" className="flex items-center gap-2 text-[13px] font-bold tracking-widest text-ink-2 uppercase">
          <MessagesSquare className="size-4" /> Forum
        </h2>
        <span className="flex-1" />
        {canPost && (
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus className="size-4" /> New post
          </button>
        )}
      </div>

      {posts.length > 0 && (
        <div role="group" aria-label="Filter posts by status" className="mb-4 flex flex-wrap gap-2">
          {filters.map((f) => {
            const on = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                  on ? "border-brand bg-brand text-white" : "border-line-2 bg-white text-ink-2 hover:bg-mute-bg",
                )}
              >
                {f.label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-mute-bg text-ink-3")}>{counts[f.value]}</span>
              </button>
            );
          })}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="card px-5 py-10 text-center text-sm text-ink-3">
          No posts yet.{canPost ? " Start one with “New post”." : ""}
        </div>
      ) : visible.length === 0 ? (
        <div className="card px-5 py-8 text-center text-sm text-ink-3">No {POST_STATUS_LABEL[filter as PostStatus].toLowerCase()} posts.</div>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              name={name}
              onName={rememberName}
              perms={{
                canReply,
                canStatus,
                canChangePost: canPost && owns(p.createdById),
                canRemoveReply: (r) => canReply && owns(r.createdById),
              }}
              onEdit={() => openEdit(p)}
              onRemove={() => setRemoving(p)}
              onRemoveReply={setRemovingReply}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit post" : "New post"}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={pending}>
              <SendHorizontal className="size-4" /> {pending ? "Saving…" : editing?.id ? "Save" : "Post"}
            </button>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Posted by" htmlFor="post-author" error={errors.authorName}>
              <input
                id="post-author"
                className={cn("input", errors.authorName && "input-error")}
                autoComplete="name"
                maxLength={80}
                placeholder="Your name"
                value={editing.values.authorName}
                onChange={(e) => set("authorName", e.target.value)}
              />
            </Field>
            <Field label="Type" htmlFor="post-kind">
              <select id="post-kind" className="input" value={editing.values.kind} onChange={(e) => set("kind", e.target.value as PostInput["kind"])}>
                {POST_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {POST_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority" htmlFor="post-priority">
              <Segmented
                id="post-priority"
                value={editing.values.important ? "IMPORTANT" : "NORMAL"}
                onChange={(v) => set("important", v === "IMPORTANT")}
                options={Object.entries(POST_PRIORITY_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Status" htmlFor="post-status">
              <select id="post-status" className="input" value={editing.values.status} onChange={(e) => set("status", e.target.value as PostStatus)}>
                {POST_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {POST_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" htmlFor="post-title" error={errors.title} className="sm:col-span-2">
              <input
                id="post-title"
                className={cn("input", errors.title && "input-error")}
                maxLength={150}
                value={editing.values.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label="Message" htmlFor="post-message" error={errors.message} className="sm:col-span-2">
              <textarea
                id="post-message"
                rows={6}
                className={cn("input", errors.message && "input-error")}
                maxLength={4000}
                value={editing.values.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </Field>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        title="Remove post?"
        message={<p>“{removing?.title}” and its replies will no longer be shown in the Forum. They stay in the records.</p>}
        confirmLabel="Remove"
        busy={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={archive}
      />

      <ConfirmDialog
        open={!!removingReply}
        title="Remove reply?"
        message={<p>This reply by {removingReply?.author} will no longer be shown in the thread.</p>}
        confirmLabel="Remove"
        busy={pending}
        onCancel={() => setRemovingReply(null)}
        onConfirm={removeReply}
      />
    </section>
  );
}

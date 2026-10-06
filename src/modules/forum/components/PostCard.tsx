"use client";

import { MessageSquare, Pencil, Reply, SendHorizontal, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import { addForumReplyAction, setForumPostStatusAction } from "../actions";
import type { PostStatus } from "../kinds";
import type { ForumPostDTO, ForumReplyDTO } from "../queries";
import { Avatar, KindBadge, StatusControl, sameName } from "./forum-ui";

/** How many of the latest replies show before "Show earlier replies". */
const VISIBLE_REPLIES = 3;

const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 3600_000;

export interface PostCardPermissions {
  canReply: boolean;
  canStatus: boolean;
  canChangePost: boolean;
  canRemoveReply: (r: ForumReplyDTO) => boolean;
}

/**
 * One Forum post and its thread: the original post on white, the replies
 * underneath on a tinted panel joined by a thread line, then the reply box.
 */
export function PostCard({
  post,
  perms,
  name,
  onName,
  onEdit,
  onRemove,
  onRemoveReply,
}: {
  post: ForumPostDTO;
  perms: PostCardPermissions;
  name: string;
  onName: (n: string) => void;
  onEdit: () => void;
  onRemove: () => void;
  onRemoveReply: (r: ForumReplyDTO) => void;
}) {
  const router = useRouter();
  const [statusPending, startStatus] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);

  const count = post.replies.length;
  const shown = expanded ? post.replies : post.replies.slice(-VISIBLE_REPLIES);
  const hidden = count - shown.length;
  const last = post.replies[count - 1];

  function changeStatus(s: PostStatus) {
    startStatus(async () => {
      const r = await setForumPostStatusAction(post.id, s);
      if (r.ok) {
        if (r.message) toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <article
      aria-labelledby={`post-${post.id}-title`}
      data-post-id={post.id}
      className={cn("card overflow-hidden", post.important && post.status !== "COMPLETED" && "border-l-4 border-l-bad-fg")}
    >
      {/* ── Original post ─────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5">
        <header className="flex items-start gap-3">
          <Avatar name={post.author} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{post.author}</p>
            <p className="text-[12px] text-ink-3">
              <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
            </p>
          </div>
          {perms.canChangePost && (
            <div className="-mt-1 -mr-2 flex shrink-0">
              <button type="button" className="icon-btn size-9" onClick={onEdit} aria-label={`Edit post ${post.title}`}>
                <Pencil className="size-4" />
              </button>
              <button type="button" className="icon-btn size-9 text-bad-fg" onClick={onRemove} aria-label={`Remove post ${post.title}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <KindBadge kind={post.kind} />
          {post.important && (
            <span className="badge gap-1 bg-bad-bg text-bad-fg">
              <Star className="size-3 fill-current" /> Important
            </span>
          )}
          {isNew(post.createdAt) && <span className="badge bg-ok-bg text-ok-fg">New</span>}
          <span className="flex-1" />
          <StatusControl
            status={post.status}
            editable={perms.canStatus}
            busy={statusPending}
            label={`Status of ${post.title}`}
            onChange={changeStatus}
          />
        </div>

        <h3 id={`post-${post.id}-title`} className="mt-3 text-[17px] leading-snug font-bold tracking-tight break-words">
          {post.title}
        </h3>
        <p className="mt-1.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{post.message}</p>
      </div>

      {/* ── Thread bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          <MessageSquare className="size-4" />
          {count === 0 ? "No replies yet" : `${count} ${count === 1 ? "reply" : "replies"}`}
        </span>
        {last && (
          <span className="hidden text-[12px] text-ink-3 sm:inline">
            Last reply by {last.author}, {formatDateTime(last.createdAt)}
          </span>
        )}
        <span className="flex-1" />
        {perms.canReply && !replying && (
          <button type="button" className="btn-ghost btn-sm text-brand-2" onClick={() => setReplying(true)} aria-label={`Reply to ${post.title}`}>
            <Reply className="size-4" /> Reply
          </button>
        )}
      </div>

      {/* ── Replies ───────────────────────────────────────────────────── */}
      {(count > 0 || replying) && (
        <div className="border-t border-line bg-shell px-4 py-4 sm:px-5" aria-label={`Replies to ${post.title}`}>
          {hidden > 0 && (
            <button type="button" className="mb-3 text-[13px] font-semibold text-brand-2 hover:underline" onClick={() => setExpanded(true)}>
              Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
            </button>
          )}
          {expanded && count > VISIBLE_REPLIES && (
            <button type="button" className="mb-3 text-[13px] font-semibold text-brand-2 hover:underline" onClick={() => setExpanded(false)}>
              Show only the latest {VISIBLE_REPLIES}
            </button>
          )}

          {shown.length > 0 && (
            <ol className="space-y-3 border-l-2 border-line-2 pl-3 sm:pl-4">
              {shown.map((r) => (
                <ReplyItem
                  key={r.id}
                  reply={r}
                  byAuthor={sameName(r.author, post.author)}
                  onRemove={perms.canRemoveReply(r) ? () => onRemoveReply(r) : undefined}
                />
              ))}
            </ol>
          )}

          {replying && (
            <ReplyComposer
              postId={post.id}
              postTitle={post.title}
              name={name}
              onName={onName}
              onDone={() => {
                setReplying(false);
                setExpanded(false);
              }}
              className={shown.length ? "mt-4" : undefined}
            />
          )}
        </div>
      )}
    </article>
  );
}

function ReplyItem({ reply, byAuthor, onRemove }: { reply: ForumReplyDTO; byAuthor: boolean; onRemove?: () => void }) {
  return (
    <li className="relative flex gap-2.5" data-reply-id={reply.id}>
      <Avatar name={reply.author} tone={byAuthor ? "brand" : "accent"} size="sm" />
      <div className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2">
        <div className="flex items-start gap-2">
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[14px] font-semibold break-words">{reply.author}</span>
            {byAuthor && <span className="badge bg-info-bg px-1.5 text-[11px] text-info-fg">Author</span>}
            <time dateTime={reply.createdAt} className="text-[12px] text-ink-3">
              {formatDateTime(reply.createdAt)}
            </time>
          </p>
          {onRemove && (
            <button
              type="button"
              className="icon-btn -mt-1 -mr-2 size-8 shrink-0 text-ink-3 hover:text-bad-fg"
              onClick={onRemove}
              aria-label={`Remove reply by ${reply.author}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink">{reply.message}</p>
      </div>
    </li>
  );
}

function ReplyComposer({
  postId,
  postTitle,
  name,
  onName,
  onDone,
  className,
}: {
  postId: string;
  postTitle: string;
  name: string;
  onName: (n: string) => void;
  onDone: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [typedName, setTypedName] = useState(name);
  const [changingName, setChangingName] = useState(!name);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const askName = changingName || !name;
  const who = askName ? typedName : name;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (pending) return;
    start(async () => {
      const r = await addForumReplyAction(postId, { message, authorName: who });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        if (!r.fieldErrors) toast.error(r.error);
        return;
      }
      onName(who);
      toast.success(r.message ?? "Reply posted.");
      setMessage("");
      setErrors({});
      onDone();
      router.refresh();
    });
  }

  const idBase = `reply-${postId}`;
  return (
    <form onSubmit={submit} className={cn("flex gap-2.5", className)} aria-label={`Reply to ${postTitle}`}>
      <Avatar name={who || "?"} tone="accent" size="sm" />
      <div className="min-w-0 flex-1 space-y-2">
        {askName ? (
          <div>
            <label htmlFor={`${idBase}-name`} className="label">
              Your name
            </label>
            <input
              id={`${idBase}-name`}
              className={cn("input sm:max-w-xs", errors.authorName && "input-error")}
              autoComplete="name"
              maxLength={80}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoFocus={!name}
            />
            {errors.authorName && (
              <p className="mt-1 text-[13px] text-bad-fg" role="alert">
                {errors.authorName}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-ink-2">
            Replying as <span className="font-semibold text-ink">{name}</span>
            <span className="text-ink-3"> · </span>
            <button
              type="button"
              className="font-semibold text-brand-2 hover:underline"
              onClick={() => {
                setTypedName(name);
                setChangingName(true);
              }}
            >
              Change
            </button>
          </p>
        )}
        <div>
          <label htmlFor={`${idBase}-msg`} className="sr-only">
            Reply
          </label>
          <textarea
            id={`${idBase}-msg`}
            rows={3}
            maxLength={2000}
            placeholder="Write a reply…"
            className={cn("input bg-white", errors.message && "input-error")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            autoFocus={!!name}
          />
          {errors.message && (
            <p className="mt-1 text-[13px] text-bad-fg" role="alert">
              {errors.message}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={onDone} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-sm" disabled={pending}>
            <SendHorizontal className="size-4" /> {pending ? "Posting…" : "Post reply"}
          </button>
        </div>
      </div>
    </form>
  );
}

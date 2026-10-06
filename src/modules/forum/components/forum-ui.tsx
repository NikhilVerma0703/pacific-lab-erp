"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { POST_KIND_LABEL, POST_STATUS_LABEL, POST_STATUS_VALUES, type PostKind, type PostStatus } from "../kinds";

/** Small building blocks shared by the Forum list, the post card and the thread. */

export const KIND_STYLE: Record<PostKind, string> = {
  ANNOUNCEMENT: "bg-info-bg text-info-fg",
  TASK: "bg-accent-bg text-accent",
  INSTRUCTION: "bg-mute-bg text-ink-2",
  QUERY: "bg-warn-bg text-warn-fg",
  PRODUCTION: "bg-[#eef0fb] text-[#3b3fa0]",
  OTHER: "bg-mute-bg text-mute-fg",
};

export const STATUS_STYLE: Record<PostStatus, string> = {
  OPEN: "border-info-fg/30 bg-info-bg text-info-fg",
  IN_PROGRESS: "border-warn-fg/30 bg-warn-bg text-warn-fg",
  COMPLETED: "border-ok-fg/30 bg-ok-bg text-ok-fg",
};

const STATUS_DOT: Record<PostStatus, string> = {
  OPEN: "bg-info-fg",
  IN_PROGRESS: "bg-warn-fg",
  COMPLETED: "bg-ok-fg",
};

export function KindBadge({ kind }: { kind: PostKind }) {
  return <span className={cn("badge", KIND_STYLE[kind])}>{POST_KIND_LABEL[kind]}</span>;
}

/** Status pill; a dropdown for people who may change it. */
export function StatusControl({
  status,
  editable,
  busy,
  label,
  onChange,
}: {
  status: PostStatus;
  editable: boolean;
  busy?: boolean;
  label: string;
  onChange: (s: PostStatus) => void;
}) {
  const pill = "inline-flex items-center gap-1.5 rounded-full border text-xs font-semibold whitespace-nowrap";
  if (!editable) {
    return (
      <span className={cn(pill, "px-2.5 py-1", STATUS_STYLE[status])}>
        <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
        {POST_STATUS_LABEL[status]}
      </span>
    );
  }
  return (
    <span className="relative inline-flex">
      <span aria-hidden="true" className={cn("pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full", STATUS_DOT[status])} />
      <select
        aria-label={label}
        value={status}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as PostStatus)}
        className={cn(pill, "min-h-8 cursor-pointer appearance-none py-1 pr-7 pl-6 focus:ring-2 focus:ring-brand-2/30 focus:outline-none disabled:opacity-60", STATUS_STYLE[status])}
      >
        {POST_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {POST_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
    </span>
  );
}

/** "Anita Sharma" → "AS", "Vikas (R&D)" → "VR". Letters and digits only. */
export function initials(name: string) {
  const words = name.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (!words.length) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, tone = "brand", size = "md" }: { name: string; tone?: "brand" | "accent"; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        tone === "brand" ? "bg-brand" : "bg-accent",
        size === "md" ? "size-10 text-[13px]" : "size-8 text-[11px]",
      )}
    >
      {initials(name)}
    </span>
  );
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const NAME_KEY = "lab-erp:forum-name";

/**
 * The name typed by whoever is posting or replying, remembered on this
 * computer (sign-in is off, so the ERP can't know who is at the screen).
 */
export function useForumName() {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* storage blocked — the name just isn't remembered */
    }
  }, []);
  const remember = useCallback((next: string) => {
    const v = next.trim();
    setName(v);
    try {
      if (v) window.localStorage.setItem(NAME_KEY, v);
      else window.localStorage.removeItem(NAME_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return [name, remember] as const;
}

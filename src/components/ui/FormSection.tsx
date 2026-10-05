"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A numbered card that groups one part of a long form. Collapsible, open by
 * default — collapsing is for the user who wants to focus, never required to
 * see the form.
 */
export function FormSection({
  id,
  index,
  title,
  description,
  actions,
  tone = "default",
  defaultOpen = true,
  children,
}: {
  id?: string;
  index?: number | string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "nested";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 rounded-xl border bg-white",
        tone === "nested" ? "border-accent/40 bg-accent-bg/40" : "border-line",
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-10 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          {index !== undefined && (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                tone === "nested" ? "bg-accent text-white" : "bg-brand text-white",
              )}
            >
              {index}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[15px] font-bold tracking-tight">{title}</span>
            {description && <span className="block text-[13px] text-ink-2">{description}</span>}
          </span>
          <ChevronDown
            className={cn("ml-auto size-5 shrink-0 text-ink-3 transition-transform", !open && "-rotate-90")}
          />
        </button>
        {actions}
      </header>
      {open && <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">{children}</div>}
    </section>
  );
}

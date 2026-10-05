"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Large, touch-friendly radio group with a thin divider between options.
 * Click the active option again to clear it.
 */
export function Segmented({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div id={id} role="radiogroup" className="inline-flex w-full max-w-md rounded-lg border border-line-2 bg-white p-1 sm:w-auto">
      {options.map((o, i) => {
        const on = value === o.value;
        return (
          <Fragment key={o.value}>
            {i > 0 && <span aria-hidden="true" className="mx-1 my-1.5 w-px shrink-0 self-stretch bg-line-2" />}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? "" : o.value)}
              className={cn(
                "min-h-10 flex-1 rounded-md px-4 text-[14px] font-semibold whitespace-nowrap transition-colors sm:flex-none",
                on ? "bg-brand text-white" : "text-ink-2 hover:bg-mute-bg",
              )}
            >
              {o.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Multi-select as toggle buttons: each option on or off. */
export function ChoiceChips<T extends string>({
  id,
  options,
  value,
  onChange,
  invalid,
}: {
  id: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  invalid?: boolean;
}) {
  return (
    <div id={id} role="group" className={cn("flex flex-wrap gap-2", invalid && "rounded-lg ring-2 ring-bad-fg/40")}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : options.map((x) => x.value).filter((v) => v === o.value || value.includes(v)))}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3.5 text-[14px] font-semibold transition-colors",
              on ? "border-brand bg-brand text-white" : "border-line-2 bg-white text-ink-2 hover:bg-mute-bg",
            )}
          >
            <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { errorAt } from "./form-context";
import { NoBodiesHint } from "./LabRowsFields";

/**
 * Body 1 … n — one complete section per body, used by every data-entry form.
 * `render(i)` draws the parts of body i (0-based); the form keeps them under
 * `bodies.i`. A body holding a validation error stays open.
 */
export function BodySections({
  n: wanted,
  idPrefix,
  render,
  name = "bodies",
}: {
  n: number;
  idPrefix: string;
  render: (i: number) => React.ReactNode;
  /** The form's array of bodies. */
  name?: string;
}) {
  const { control, formState } = useFormContext<FieldValues>();
  // Draw a body only once its values exist (they are added right after n
  // changes), so its repeating rows (resins, grits …) start from them.
  const ready = ((useWatch({ control, name }) as unknown[] | undefined) ?? []).length;
  const n = Math.min(wanted, ready);
  if (wanted < 1) {
    return (
      <NoBodiesHint>
        Enter <strong>Number of Bodies (n)</strong> — a section for each body opens here.
      </NoBodiesHint>
    );
  }
  const hasError = (i: number) => {
    const node = (formState.errors as Record<string, unknown>).bodies as unknown[] | undefined;
    return !!node?.[i];
  };
  return (
    <div className="space-y-4">
      {n > 1 && (
        <nav aria-label="Go to body" className="flex flex-wrap gap-2">
          {Array.from({ length: n }, (_, i) => (
            <a
              key={i}
              href={`#${idPrefix}-body-${i + 1}`}
              className={cn("btn-secondary btn-sm", hasError(i) && "border-bad-fg text-bad-fg")}
            >
              Body {i + 1}
            </a>
          ))}
        </nav>
      )}
      {Array.from({ length: n }, (_, i) => (
        <BodyCard key={i} id={`${idPrefix}-body-${i + 1}`} index={i + 1} forceOpen={hasError(i)}>
          {render(i)}
        </BodyCard>
      ))}
    </div>
  );
}

function BodyCard({ id, index, forceOpen, children }: { id: string; index: number; forceOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  // A body opened because of an error stays open once the error is fixed.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  const shown = open || forceOpen;
  return (
    <section id={id} aria-label={`Body ${index}`} className="scroll-mt-20 overflow-hidden rounded-xl border border-brand/25 bg-shell">
      <button
        type="button"
        // A body with an error stays open until the error is fixed.
        onClick={() => !forceOpen && setOpen((o) => !o)}
        aria-expanded={shown}
        className="flex min-h-11 w-full items-center gap-3 bg-brand px-4 text-left text-white"
      >
        <span className="text-[14px] font-bold tracking-widest uppercase">Body {index}</span>
        <ChevronDown className={cn("ml-auto size-5 shrink-0 transition-transform", !shown && "-rotate-90")} />
      </button>
      {shown && <div className="space-y-4 p-3 sm:p-4">{children}</div>}
    </section>
  );
}

/** One part of a body (Material Choices & Pigments, Design, Vein, L, a, b). */
export function BodyPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h3 className="mb-3 text-[13px] font-bold tracking-wide text-ink-2 uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * One body's L, a, b. "pressPolish": a Post Press and a Post Polish reading
 * (`name.postPress`, `name.postPolish`); "single": one reading (`name.lab`).
 */
export function BodyLabFields({ name, label, variant = "pressPolish" }: { name: string; label: string; variant?: "pressPolish" | "single" }) {
  const { register, formState } = useFormContext<FieldValues>();
  const rows: { path: string; title?: string; dot?: string }[] =
    variant === "single"
      ? [{ path: `${name}.lab` }]
      : [
          { path: `${name}.postPress`, title: "Post Press", dot: "bg-brand" },
          { path: `${name}.postPolish`, title: "Post Polish", dot: "bg-accent" },
        ];
  const cols = variant === "single" ? "grid-cols-[repeat(3,minmax(0,1fr))]" : "grid-cols-[96px_repeat(3,minmax(0,1fr))] sm:grid-cols-[120px_repeat(3,minmax(0,1fr))]";
  return (
    <div className="max-w-2xl space-y-2">
      <div className={cn("grid gap-2 px-1 text-xs font-bold text-ink-3", cols)}>
        {variant !== "single" && <span />}
        <span>L</span>
        <span>a</span>
        <span>b</span>
      </div>
      {rows.map((r) => {
        const errs = (["l", "a", "b"] as const).map((k) => errorAt(formState.errors, `${r.path}.${k}`)).filter(Boolean);
        return (
          <div key={r.path}>
            <div className={cn("grid items-center gap-2", cols)}>
              {r.title && (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                  <span className={cn("size-2 shrink-0 rounded-full", r.dot)} />
                  {r.title}
                </span>
              )}
              {(["l", "a", "b"] as const).map((k) => (
                <input
                  key={k}
                  aria-label={`${label}${r.title ? ` ${r.title}` : ""} ${k === "l" ? "L" : k}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={k === "l" ? "L" : k}
                  className={cn("input px-2 text-center", errorAt(formState.errors, `${r.path}.${k}`) && "input-error")}
                  {...register(`${r.path}.${k}`)}
                />
              ))}
            </div>
            {errs.length > 0 && <p className="mt-1 text-[13px] text-bad-fg">{errs[0]}</p>}
          </div>
        );
      })}
    </div>
  );
}

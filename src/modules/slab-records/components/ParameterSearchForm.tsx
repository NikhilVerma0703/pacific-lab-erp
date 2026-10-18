"use client";

import { CalendarDays, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { MasterPicker } from "@/components/ui/MasterPicker";
import { normalizeKey } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import type { MasterOption, MasterRef } from "@/modules/master-data/types";
import { shiftDays, type Period } from "@/modules/downloads/period";

type Mode = "any" | "all" | "date" | "range";

const MODES: { value: Mode; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "all", label: "All (up to today)" },
  { value: "date", label: "Date Wise" },
  { value: "range", label: "Date Range" },
];

/**
 * "Search a Slab by Any Parameter": Production Date, Slab Number and Design
 * Name, in any combination. A plain GET form — the page renders the results.
 */
export function ParameterSearchForm({
  today,
  initial,
  designNames,
}: {
  today: string;
  initial: { period: Period | null; slab: string; design: string };
  designNames: string[];
}) {
  const [mode, setMode] = useState<Mode>(initial.period?.mode ?? "any");
  const [date, setDate] = useState(initial.period?.date ?? today);
  const [from, setFrom] = useState(initial.period?.from || shiftDays(today, -6));
  const [to, setTo] = useState(initial.period?.to ?? today);
  const [slab, setSlab] = useState(initial.slab);
  const designOptions = useMemo<MasterOption[]>(() => designNames.map((label) => ({ id: label, label, code: null, isActive: true })), [designNames]);
  const [design, setDesign] = useState<MasterRef | null>(() => {
    const found = designNames.find((d) => normalizeKey(d) === normalizeKey(initial.design));
    return initial.design ? { id: found ?? initial.design, label: found ?? initial.design } : null;
  });
  const badRange = mode === "range" && !!from && !!to && from > to;
  const slabBad = !!slab.trim() && !/^\d+$/.test(slab.trim());

  const calendar = (key: string, label: string, value: string, set: (v: string) => void, extra: { min?: string; max?: string } = {}) => (
    <Field label={label} htmlFor={`slab-${key}`} className="w-full sm:w-48">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <input
          id={`slab-${key}`}
          name={key}
          type="date"
          className={cn("input pl-9", badRange && "input-error")}
          value={value}
          min={extra.min}
          max={extra.max}
          onChange={(e) => set(e.target.value)}
        />
      </div>
    </Field>
  );

  return (
    <form method="get" action="/slab-records#any-results" className="space-y-4" noValidate>
      <input type="hidden" name="find" value="any" />
      <div className="flex flex-wrap items-start gap-4">
        <Field label="Production Date" htmlFor="slab-period" className="w-full sm:w-48">
          <select id="slab-period" name="period" className="input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        {mode === "date" && calendar("date", "Select Date", date, setDate)}
        {mode === "range" && (
          <>
            {calendar("from", "From", from, setFrom, { max: to || undefined })}
            {calendar("to", "To", to, setTo, { min: from || undefined })}
          </>
        )}
        <Field label="Slab Number" htmlFor="slab-slab" className="w-full sm:w-40" error={slabBad ? "Whole numbers only." : undefined} hint={slabBad ? undefined : "Any slab when blank"}>
          <input
            id="slab-slab"
            name="slab"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 5083"
            className={cn("input tabular-nums", slabBad && "input-error")}
            value={slab}
            onChange={(e) => setSlab(e.target.value)}
          />
        </Field>
        <Field label="Design Name" htmlFor="slab-design" className="w-full sm:w-72">
          <MasterPicker id="slab-design" options={designOptions} value={design} onChange={setDesign} allowCustom={false} placeholder="Any design name" noun="design name" />
          <input type="hidden" name="design" value={design?.label ?? ""} />
        </Field>
      </div>
      {badRange && (
        <p className="text-[13px] text-bad-fg" role="alert">
          From must be on or before To.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={badRange}>
          <Search className="size-4" /> Search slabs
        </button>
        <Link href="/slab-records" className="btn-ghost">
          <RotateCcw className="size-4" /> Clear
        </Link>
        <span className="text-[13px] text-ink-3">Use one filter or several — a record must match them all.</span>
      </div>
    </form>
  );
}

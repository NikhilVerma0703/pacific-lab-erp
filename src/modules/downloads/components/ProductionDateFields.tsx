"use client";

import { CalendarDays } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, shiftDays, type Period, type PeriodMode } from "../period";

/**
 * Production Date: All / Date Wise / Date Range, then the calendar(s) the
 * choice needs — one date, or From and To. Returns its fields side by side so
 * the parent row lays them out (and shows `error` under the row). With
 * `named`, the inputs carry `period`, `date`, `from`, `to` names for a plain
 * GET form.
 */
export function ProductionDateFields({
  idPrefix,
  value,
  onChange,
  today,
  named,
  error,
  fieldClass = "w-full sm:w-48",
}: {
  idPrefix: string;
  value: Period;
  onChange: (p: Period) => void;
  today: string;
  named?: boolean;
  error?: string | null;
  fieldClass?: string;
}) {
  const setMode = (mode: PeriodMode) => {
    // Keep what was picked before; a first range is the 7 days up to today.
    if (mode === "date") onChange({ ...value, mode, date: value.date || value.to || today });
    else if (mode === "range") {
      const to = value.to || today;
      onChange({ ...value, mode, to, from: value.from && value.from <= to ? value.from : shiftDays(to, -6) });
    } else onChange({ ...value, mode });
  };

  const calendar = (key: "date" | "from" | "to", label: string, extra: { min?: string; max?: string } = {}) => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`} className={fieldClass}>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <input
          id={`${idPrefix}-${key}`}
          name={named ? key : undefined}
          type="date"
          required
          className={cn("input pl-9", error && "input-error")}
          value={value[key]}
          max={extra.max ?? today}
          min={extra.min}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      </div>
    </Field>
  );

  return (
    <>
      <Field label="Production Date" htmlFor={`${idPrefix}-period`} className={fieldClass}>
        <select
          id={`${idPrefix}-period`}
          name={named ? "period" : undefined}
          className="input"
          value={value.mode}
          onChange={(e) => setMode(e.target.value as PeriodMode)}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {value.mode === "date" && calendar("date", "Select Date")}
      {value.mode === "range" && (
        <>
          {calendar("from", "From", { max: value.to && value.to < today ? value.to : today })}
          {calendar("to", "To", { min: value.from || undefined })}
        </>
      )}
    </>
  );
}

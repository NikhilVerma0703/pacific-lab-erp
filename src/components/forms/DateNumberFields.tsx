"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch, type FieldValues } from "react-hook-form";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { errorAt } from "./errors";

/** What the server says about a date: the S.No. the entry gets and the Slab Number to start from. */
export interface DateNumbers {
  serialNo: number;
  slabNumber: number | null;
  /** No other entry on this date: the Slab Number is typed by hand. */
  first: boolean;
}

/**
 * Date, S.No. and Slab Number — the same in every form.
 *  - Date: today for a new entry; any date can be picked for older records.
 *  - S.No.: 1, 2, 3 … within the selected date, from the saved records.
 *    Picking another date recalculates it.
 *  - Slab Number: the previous entry's slab + 1; typed by hand for the first
 *    entry of a date.
 * Both numbers are only suggestions: they can be typed over before saving.
 * A typed S.No. puts the record at that place in its date and moves the
 * entries after it down one, so the date keeps running 1, 2, 3 …
 * The form holds `${dateName}`, `serialNo` and `slabNumber` (strings).
 */
export function DateNumberFields({
  idPrefix,
  dateName,
  mode,
  initial,
  fetchNumbers,
  onNumbers,
  canChangeDate,
  canOverride,
}: {
  idPrefix: string;
  dateName: string;
  mode: "create" | "edit";
  /** The numbers the page was rendered with (for the date in the form). */
  initial: DateNumbers;
  fetchNumbers: (date: string) => Promise<DateNumbers>;
  /** Called whenever new numbers arrive (the form remembers the suggested numbers). */
  onNumbers?: (n: DateNumbers) => void;
  canChangeDate: boolean;
  /** This role may type over the suggested S.No. and Slab Number. */
  canOverride: boolean;
}) {
  const { control, register, setValue, getValues, formState } = useFormContext<FieldValues>();
  const errors = formState.errors;
  const date = useWatch({ control, name: dateName }) as string | undefined;
  const [numbers, setNumbers] = useState<DateNumbers>(initial);
  const [loading, setLoading] = useState(false);
  const shownFor = useRef(getValues(dateName) as string | undefined);
  const savedDate = useRef(getValues(dateName) as string | undefined);

  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date === shownFor.current) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const n = await fetchNumbers(date);
      if (!alive) return;
      shownFor.current = date;
      setLoading(false);
      setNumbers(n);
      onNumbers?.(n);
      if (mode === "edit" && date === savedDate.current) return; // back on its own date: keeps its numbers
      setValue("serialNo", String(n.serialNo), { shouldDirty: true });
      if (mode === "create") setValue("slabNumber", n.slabNumber === null ? "" : String(n.slabNumber), { shouldDirty: true });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Moved to another date on an edit, or a new entry: the S.No. comes from that date.
  const onOwnDate = mode === "edit" && date === savedDate.current;
  const serialHint = loading
    ? "Checking this date…"
    : !canOverride
      ? onOwnDate
        ? undefined
        : "Next S.No. for this date."
      : onOwnDate
        ? `S.No. on this date. Type another to move it — the rest of ${fmt(date)} follows.`
        : mode === "edit"
          ? `S.No. on the new date — type another place if you need one.`
          : numbers.serialNo === 1
            ? "First entry on this date."
            : `Next S.No. for this date. Type a lower one to put it earlier — the rest follow.`;
  const slabHint = !canOverride
    ? mode === "edit"
      ? undefined
      : numbers.first
        ? "First entry on this date — enter the Slab Number."
        : "Previous entry's Slab Number + 1."
    : mode === "edit"
      ? "Change it if the slab was numbered differently."
      : numbers.first
        ? "First entry on this date — enter the Slab Number."
        : numbers.slabNumber === null
          ? "The previous entry of this date has no Slab Number — enter it."
          : "Previous entry's Slab Number + 1 — change it if you need to.";

  return (
    <>
      <Field label="Date" htmlFor={`${idPrefix}-date`} error={errorAt(errors, dateName)}>
        <input
          id={`${idPrefix}-date`}
          type="date"
          readOnly={!canChangeDate}
          className={cn("input", !canChangeDate && "pointer-events-none bg-mute-bg text-ink-2", errorAt(errors, dateName) && "input-error")}
          {...register(dateName)}
        />
      </Field>
      <Field label="S.No." htmlFor={`${idPrefix}-serialNo`} error={errorAt(errors, "serialNo")} hint={serialHint}>
        <input
          id={`${idPrefix}-serialNo`}
          inputMode="numeric"
          readOnly={!canOverride}
          className={cn("input tabular-nums", !canOverride && "bg-mute-bg text-ink-2", errorAt(errors, "serialNo") && "input-error")}
          {...register("serialNo")}
        />
      </Field>
      <Field label="Slab Number" htmlFor={`${idPrefix}-slabNumber`} error={errorAt(errors, "slabNumber")} hint={slabHint}>
        <input
          id={`${idPrefix}-slabNumber`}
          inputMode="numeric"
          readOnly={!canOverride}
          placeholder={canOverride ? "Enter slab number" : undefined}
          className={cn("input tabular-nums", !canOverride && "bg-mute-bg text-ink-2", errorAt(errors, "slabNumber") && "input-error")}
          {...register("slabNumber")}
        />
      </Field>
    </>
  );
}

/** "18-10-2026" — the date a hint talks about. */
function fmt(iso: string | undefined) {
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("-") : "that date";
}

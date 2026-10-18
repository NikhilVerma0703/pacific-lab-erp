"use client";

import { RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { readNumber, TOLERANCE } from "../search";

/** The three boxes of "Search a Slab by L, a, b Measurements". A plain GET form. */
export function MeasurementSearchForm({ initial }: { initial: { l: string; a: string; b: string } }) {
  const [v, setV] = useState(initial);
  const [tried, setTried] = useState(false);
  const bad = {
    l: readNumber(v.l, { min: 0, max: 100 }) === null,
    a: readNumber(v.a, { min: -128, max: 128 }) === null,
    b: readNumber(v.b, { min: -128, max: 128 }) === null,
  };
  const incomplete = bad.l || bad.a || bad.b;

  const box = (k: "l" | "a" | "b", label: string, hint: string) => (
    <Field label={label} htmlFor={`slab-${k}`} hint={hint} error={tried && bad[k] ? "Enter a number." : undefined}>
      <input
        id={`slab-${k}`}
        name={k}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.0"
        className={cn("input tabular-nums", tried && bad[k] && "input-error")}
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
      />
    </Field>
  );

  return (
    <form
      method="get"
      action="/slab-records#lab-results"
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        if (incomplete) {
          e.preventDefault();
          setTried(true);
        }
      }}
    >
      <input type="hidden" name="find" value="lab" />
      <div className="grid gap-4 sm:grid-cols-3">
        {box("l", "Enter Your L Value", "0 – 100")}
        {box("a", "Enter Your a Value", "−128 … 128")}
        {box("b", "Enter Your b Value", "−128 … 128")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary">
          <Search className="size-4" /> Search slabs
        </button>
        <Link href="/slab-records" className="btn-ghost">
          <RotateCcw className="size-4" /> Clear
        </Link>
        <span className="text-[13px] text-ink-3">Every value within ±{TOLERANCE} is a match.</span>
      </div>
    </form>
  );
}

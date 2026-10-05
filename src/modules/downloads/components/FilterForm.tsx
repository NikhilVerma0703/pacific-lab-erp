"use client";

import { CalendarDays, Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import type { ExportFilters, MaterialKind } from "../filters";
import { MATERIAL_KIND_LABEL } from "../filters";

interface Opt {
  id: string;
  label: string;
}

/**
 * The filter bar. A plain GET form: Apply puts the filters in the URL, the
 * server renders the matching records, and the export link reuses the same URL.
 */
export function FilterForm({
  today,
  initial,
  patterns,
  materials,
}: {
  today: string;
  initial: ExportFilters;
  patterns: Opt[];
  materials: Record<MaterialKind, Opt[]>;
}) {
  const [design, setDesign] = useState(initial.design);
  const [mkind, setMkind] = useState(initial.materialKind);

  return (
    <form method="get" action="/downloads#filtered" className="space-y-4">
      <input type="hidden" name="apply" value="1" />
      {/* Row 1: the date every filter and result is for. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Field label="Date" htmlFor="f-date">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input id="f-date" name="date" type="date" required className="input pl-9" defaultValue={initial.date} max={today} />
          </div>
        </Field>
      </div>

      {/* Rows below: any combination of filters — every one chosen must match. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Field label="Sample Type" htmlFor="f-type">
          <select id="f-type" name="type" className="input" defaultValue={initial.sampleType}>
            <option value="">All sample types</option>
            <option value="CREATIVE">Creative Sample</option>
            <option value="INSPIRED">Inspired Sample</option>
          </select>
        </Field>
        <Field label="Design" htmlFor="f-design">
          <select id="f-design" name="design" className="input" value={design} onChange={(e) => setDesign(e.target.value as typeof design)}>
            <option value="">All designs</option>
            <option value="PLAIN_BODY">Plain Body</option>
            <option value="NON_PLAIN_BODY">Non-Plain Body</option>
          </select>
        </Field>
        <Field label="Design Pattern" htmlFor="f-pattern">
          <select id="f-pattern" name="pattern" className="input" defaultValue={initial.pattern} disabled={design === "PLAIN_BODY"}>
            <option value="">All patterns</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Material Consumption" htmlFor="f-mkind">
          <select id="f-mkind" name="mkind" className="input" value={mkind} onChange={(e) => setMkind(e.target.value as typeof mkind)}>
            <option value="">No material filter</option>
            {(Object.keys(MATERIAL_KIND_LABEL) as MaterialKind[]).map((k) => (
              <option key={k} value={k}>
                {MATERIAL_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Material" htmlFor="f-material">
          <select
            key={mkind}
            id="f-material"
            name="material"
            className="input"
            defaultValue={mkind === initial.materialKind ? initial.material : ""}
            disabled={!mkind}
          >
            <option value="">{mkind ? `All ${MATERIAL_KIND_LABEL[mkind].toLowerCase()}` : "—"}</option>
            {mkind &&
              materials[mkind].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          <Filter className="size-4" /> Apply
        </button>
        <Link href="/downloads#filtered" className="btn-ghost">
          <RotateCcw className="size-4" /> Clear filters
        </Link>
      </div>
    </form>
  );
}

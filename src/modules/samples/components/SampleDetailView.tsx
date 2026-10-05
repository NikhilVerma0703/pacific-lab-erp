"use client";

import Link from "next/link";
import { useState } from "react";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { FormulationDTO, SampleDetail } from "../queries";
import { FormulationView } from "@/components/lab/FormulationView";
import { AttachmentCard } from "./AttachmentsField";
import { FileViewer, type ViewableFile } from "./FileViewer";


/** Read-only, form-shaped view of everything recorded for a sample. */
export function SampleDetailView({ s }: { s: SampleDetail }) {
  const [viewing, setViewing] = useState<ViewableFile | null>(null);
  const isCreative = s.sampleType?.code === "CREATIVE";
  const f = (role: FormulationDTO["role"]) => s.formulations.find((x) => x.role === role);
  const hasRoy = (list: { code: string | null }[]) => list.some((v) => v.code === "ROY_BODY");
  let n = 0;
  const idx = () => ++n;

  return (
    <div className="space-y-4">
      <Block index={idx()} title="Basic Information">
        <Grid>
          <Item label="S.No." value={s.serialNo} />
          <Item label="Slab Number" value={s.slabNumber} />
          <Item label="Date" value={formatDate(s.sampleDate)} />
          <Item label="Sample Type" value={s.sampleType?.label} />
          {isCreative && <Item label="Number of Bodies" value={s.numberOfBodies} />}
          {s.sampleType?.code === "INSPIRED" && (
            <Item
              label="Physical Sample Present?"
              value={s.physicalSamplePresent === null ? null : s.physicalSamplePresent ? "Yes" : "No (Rectification)"}
            />
          )}
          {s.inwardEntry && (
            <Item
              label="Inward / Outward"
              value={
                <Link href={`/inward-outward/${s.inwardEntry.id}`} className="text-brand-2 underline">
                  Serial No. {s.inwardEntry.serialNo}
                </Link>
              }
            />
          )}
          <Item label="Status" value={s.status === "DRAFT" ? "Draft" : "Saved"} />
        </Grid>
      </Block>

      {isCreative && (
        <>
          <Block index={idx()} title="Material Choices & Pigment">
            <FormulationView f={f("MAIN_BODY")} />
          </Block>

          <Block index={idx()} title="Design">
            <Grid>
              <Item label="Design" value={s.designCategory === "PLAIN_BODY" ? "Plain Body" : s.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : null} />
              {s.designCategory === "NON_PLAIN_BODY" && (
                <Item label="Design Pattern(s)" value={s.designPatterns.map((p) => p.label).join(", ")} wide />
              )}
            </Grid>
            {hasRoy(s.designPatterns) && (
              <Nested title="Roy Body Formulation — Design">
                <FormulationView f={f("DESIGN_ROY_BODY")} />
              </Nested>
            )}
          </Block>

          <Block index={idx()} title="Mixer Type">
            <Grid>
              <Item label="Mixer Type" value={s.mixerType?.label} />
            </Grid>
          </Block>

          <Block index={idx()} title="Vein">
            <Grid>
              <Item label="Vein" value={s.hasVein === null ? null : s.hasVein ? "Yes" : "No"} />
              <Item label="How Vein Introduced" value={s.veinMethods.map((m) => m.label).join(", ")} wide />
              <Item label="Vein details" value={s.veinNotes} wide />
            </Grid>
            {hasRoy(s.veinMethods) && (
              <Nested title="Roy Body Formulation — Vein">
                <FormulationView f={f("VEIN_ROY_BODY")} />
              </Nested>
            )}
          </Block>

          <Block index={idx()} title="L, a, b Measurements">
            {!s.numberOfBodies ? (
              <Empty />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
                {(["POST_PRESS", "POST_POLISH"] as const).map((stage) => (
                  <div key={stage} className={cn(stage === "POST_POLISH" ? "lg:border-l-2 lg:border-line-2 lg:pl-6" : "lg:pr-6")}>
                    <h4 className="mb-2 text-[13px] font-bold tracking-wide text-brand uppercase">
                      {stage === "POST_PRESS" ? "Post Press" : "Post Polish"}
                    </h4>
                    <table className="w-full text-[14px]">
                      <thead>
                        <tr>
                          <th className="th">Body</th>
                          <th className="th">L</th>
                          <th className="th normal-case">a</th>
                          <th className="th normal-case">b</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: s.numberOfBodies! }, (_, i) => {
                          const m = s.measurements.find((x) => x.stage === stage && x.bodyIndex === i + 1);
                          return (
                            <tr key={i}>
                              <td className="td font-semibold">Body {i + 1}</td>
                              <td className="td tabular-nums">{formatNumber(m?.l)}</td>
                              <td className="td tabular-nums">{formatNumber(m?.a)}</td>
                              <td className="td tabular-nums">{formatNumber(m?.b)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </Block>
        </>
      )}

      <Block index={idx()} title="Sample Output">
        {s.attachments.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.attachments.map((a) => (
              <AttachmentCard key={a.id} file={a} onView={() => setViewing(a)} />
            ))}
          </ul>
        ) : (
          <Empty text="No files attached." />
        )}
        {s.remarks && (
          <div className="mt-4">
            <p className="label">Remarks</p>
            <p className="whitespace-pre-wrap">{s.remarks}</p>
          </div>
        )}
      </Block>

      <p className="px-1 text-[12px] text-ink-3">
        Created {formatDateTime(s.createdAt)}
        {s.createdBy ? ` by ${s.createdBy}` : ""} · Last updated {formatDateTime(s.updatedAt)}
        {s.updatedBy ? ` by ${s.updatedBy}` : ""}
      </p>

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function Block({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card break-inside-avoid">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{index}</span>
        <h3 className="text-[15px] font-bold">{title}</h3>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export function Nested({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-accent/40 bg-accent-bg/40 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-[14px] font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">R</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}

export function Item({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="label">{label}</dt>
      <dd className={cn("min-h-6 text-[15px]", empty ? "text-ink-3" : "font-semibold")}>{empty ? "—" : value}</dd>
    </div>
  );
}

export function Empty({ text = "Not recorded." }: { text?: string }) {
  return <p className="text-sm text-ink-3">{text}</p>;
}

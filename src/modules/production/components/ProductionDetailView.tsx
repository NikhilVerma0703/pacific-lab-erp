"use client";

import { useState } from "react";
import { BodyReadingsView } from "@/components/forms/BodyReadingsView";
import { StageRowsView } from "@/components/forms/StageRowsView";
import { bodiesDesignText } from "@/modules/samples/bodies";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AttachmentCard } from "@/modules/samples/components/AttachmentsField";
import { FileViewer, type ViewableFile } from "@/modules/samples/components/FileViewer";
import type { ProductionDetail } from "../queries";

/** Review page: everything recorded for a production sample, in the order of the form. */
export function ProductionDetailView({ s }: { s: ProductionDetail }) {
  const [viewing, setViewing] = useState<ViewableFile | null>(null);
  // Entries of the earlier form also recorded a design per body (and Roy Body readings).
  const earlier = s.bodies.some((b) => b.designCategory !== null || b.designPatterns.length > 0 || b.royBody);
  const basic: [string, React.ReactNode][] = [
    ["Date", formatDate(s.sampleDate)],
    ["S.No.", s.serialNo],
    ["Slab Number", s.slabNumber],
    ["Design Name", s.designName],
    ["Number of Bodies (N)", s.numberOfBodies],
  ];

  return (
    <div className="space-y-4">
      <Block index={1} title="Basic Information">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {basic.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
              <dd className="mt-0.5 text-[15px] break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block index={2} title="L, a, b Measurements">
        <BodyReadingsView bodies={s.bodies} />
      </Block>

      <Block index={3} title="Sample Output">
        {s.attachments.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {s.attachments.map((a) => (
              <AttachmentCard key={a.id} file={a} onView={() => setViewing(a)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No files attached.</p>
        )}
      </Block>

      <Block index={4} title="Remarks">
        {s.remarks ? <p className="text-[15px] break-words whitespace-pre-wrap">{s.remarks}</p> : <p className="text-sm text-ink-3">Not recorded.</p>}
      </Block>

      {earlier && (
        <Block index={5} title="Recorded with the earlier form">
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Design per body</p>
              <p className="mt-0.5 text-[15px] break-words">
                {bodiesDesignText(s.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns }))) || "—"}
              </p>
            </div>
            {s.bodies
              .filter((b) => b.royBody)
              .map((b) => {
                const roy = b.royBody!;
                const n = Math.max(roy.numberOfBodies ?? 0, ...roy.readings.map((r) => r.bodyIndex));
                const at = (stage: "POST_PRESS" | "POST_POLISH", i: number) => roy.readings.find((r) => r.stage === stage && r.bodyIndex === i) ?? null;
                return (
                  <div key={b.index}>
                    <p className="mb-2 text-[13px] font-bold">Roy Body — Body {b.index} (Number of Bodies {roy.numberOfBodies ?? "—"})</p>
                    <StageRowsView
                      rows={Array.from({ length: n }, (_, k) => ({ label: `Roy Body ${k + 1}`, postPress: at("POST_PRESS", k + 1), postPolish: at("POST_POLISH", k + 1) }))}
                    />
                  </div>
                );
              })}
          </div>
        </Block>
      )}

      <p className="px-1 text-[12px] text-ink-3">
        Created {formatDateTime(s.createdAt)}
        {s.createdBy ? ` by ${s.createdBy}` : ""} · Last updated {formatDateTime(s.updatedAt)}
        {s.updatedBy ? ` by ${s.updatedBy}` : ""}
      </p>

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Block({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card break-inside-avoid">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{index}</span>
        <h2 className="text-[15px] font-bold">{title}</h2>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

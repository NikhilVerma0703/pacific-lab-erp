"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadingRowsView } from "@/components/forms/ReadingRowsView";
import { RoyBodyView } from "@/components/lab/RoyBodyView";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { AttachmentCard } from "@/modules/samples/components/AttachmentsField";
import { FileViewer, type ViewableFile } from "@/modules/samples/components/FileViewer";
import { designType, typeOfPattern } from "@/modules/forms/design-types";
import { inwardDesignText } from "../design-text";
import type { DesignTypeDTO, InwardDetail } from "../queries";

/** Review page: everything recorded for an Inward / Outward entry, in the order of the form. */
export function InwardDetailView({ e }: { e: InwardDetail }) {
  const [viewing, setViewing] = useState<ViewableFile | null>(null);
  let section = 0;
  const next = () => ++section;
  const has = (k: DesignTypeDTO["type"]) => e.designTypes.some((t) => t.type === k);
  // Design patterns of an earlier form that are not design types (kept when the entry is saved again).
  const otherPatterns = e.legacyBodies ? [] : (e.bodies[0]?.designPatterns ?? []).filter((p) => !typeOfPattern(p));
  const earlier = e.legacyBodies || !!e.labSample || !!e.recreationAttempts || e.bodies.some((b) => b.royBody) || otherPatterns.length > 0;

  return (
    <div className="space-y-4">
      <Block index={next()} title="Sample Details">
        <Pairs
          items={[
            ["Date", formatDate(e.entryDate)],
            ["S.No.", e.serialNo],
            ["Slab Number", e.slabNumber],
            ["Company Name", e.company?.label],
            ["Design Name", e.sampleDesignName],
          ]}
        />
      </Block>

      <Block index={next()} title="Design Type and Bodies">
        <div className="space-y-4">
          <Pairs
            items={[
              ["Plain Body", e.plainBody === null ? null : e.plainBody ? "Yes" : "No"],
              ...(e.plainBody === false ? ([["Design Types", e.designTypes.map((t) => designType(t.type).label).join(", ")]] as [string, React.ReactNode][]) : []),
              ["Number of Bodies (N)", e.numberOfBodies],
            ]}
          />
          {e.designTypes.map((t) => (
            <TypeView key={t.type} t={t} />
          ))}
        </div>
      </Block>

      <Block index={next()} title="L, a, b Measurements">
        <div className="space-y-5">
          <ReadingRowsView rows={e.bodies.map((b) => b.lab)} rowLabel="Body" />
          {has("ROY_BODY") && <ReadingRowsView rows={e.royBodies} rowLabel="Roy Body" />}
          {has("CHESSBOARD") && <ReadingRowsView rows={e.chessboardBodies} rowLabel="Chessboard Body" />}
        </div>
      </Block>

      <Block index={next()} title="Sample Output">
        {e.attachments.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {e.attachments.map((a) => (
              <AttachmentCard key={a.id} file={a} onView={() => setViewing(a)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No files attached.</p>
        )}
      </Block>

      <Block index={next()} title="Remarks">
        {e.remarks ? <p className="text-[15px] break-words whitespace-pre-wrap">{e.remarks}</p> : <p className="text-sm text-ink-3">Not recorded.</p>}
      </Block>

      {earlier && (
        <Block index={next()} title="Recorded with the earlier form">
          <div className="space-y-4">
            <Pairs
              items={[
                [
                  "Linked lab sample",
                  e.labSample ? (
                    <Link href={`/samples/${e.labSample.id}`} className="font-semibold text-accent underline">
                      S.No. {e.labSample.serialNo}
                      {e.labSample.slabNumber ? ` · Slab ${e.labSample.slabNumber}` : ""}
                    </Link>
                  ) : null,
                ],
                ["Design per body", e.legacyBodies ? inwardDesignText(e) : null],
                ...(otherPatterns.length ? ([["Other design patterns", otherPatterns.map((p) => p.label).join(", ")]] as [string, React.ReactNode][]) : []),
              ]}
            />
            {e.recreationAttempts && (
              <div>
                <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Lab Recreation Attempts</p>
                <p className="mt-0.5 text-[15px] break-words whitespace-pre-wrap">{e.recreationAttempts}</p>
              </div>
            )}
            {e.bodies
              .filter((b) => b.royBody)
              .map((b) => (
                <div key={b.index} className="rounded-xl border border-accent/40 bg-accent-bg/40 p-4">
                  <p className="mb-2 text-[13px] font-bold">Roy Body Formulation — Body {b.index}</p>
                  <RoyBodyView f={b.royBody} />
                </div>
              ))}
          </div>
        </Block>
      )}

      <p className="px-1 text-[12px] text-ink-3">
        Created {formatDateTime(e.createdAt)}
        {e.createdBy ? ` by ${e.createdBy}` : ""} · Last updated {formatDateTime(e.updatedAt)}
        {e.updatedBy ? ` by ${e.updatedBy}` : ""}
      </p>

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function TypeView({ t }: { t: DesignTypeDTO }) {
  const def = designType(t.type);
  const vein = t.type === "KREOS" || t.type === "VEIN";
  return (
    <section aria-label={def.label} className="overflow-hidden rounded-xl border border-brand/25 bg-shell">
      <h3 className="bg-brand px-4 py-2.5 text-[14px] font-bold tracking-widest text-white uppercase">{def.label}</h3>
      <div className="space-y-3 p-3 sm:p-4">
        {def.special && <Pairs items={[[def.special.countLabel, t.bodyCount]]} />}
        {vein && (
          <Pairs
            items={[
              ["Vein Present", t.veinPresent === null ? null : t.veinPresent ? "Yes" : "No"],
              ...(t.veinPresent
                ? ([
                    ["Mixer Type", t.mixerType?.label],
                    ["Vein Details", t.veinDetails.map((v) => v.label).join(", ")],
                  ] as [string, React.ReactNode][])
                : []),
            ]}
          />
        )}
        {(t.type === "CARRARA" || (vein && t.veinPresent)) && (
          <Colours title={t.type === "CARRARA" ? "Carrara Colors Used" : t.type === "KREOS" ? "Kreos Vein Colors Used" : "Vein Colors Used"} colours={t.colours} />
        )}
      </div>
    </section>
  );
}

function Colours({ title, colours }: { title: string; colours: DesignTypeDTO["colours"] }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{title}</p>
      {colours.length ? (
        <table className="w-full max-w-md text-[14px]">
          <thead>
            <tr>
              <th className="th">Colour</th>
              <th className="th text-right">Quantity (gm)</th>
            </tr>
          </thead>
          <tbody>
            {colours.map((c) => (
              <tr key={c.colour.id}>
                <td className="td">{c.colour.label}</td>
                <td className="td text-right tabular-nums">{formatNumber(c.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-3">—</p>
      )}
    </div>
  );
}

function Pairs({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{label}</dt>
          <dd className="mt-0.5 text-[15px] break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
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

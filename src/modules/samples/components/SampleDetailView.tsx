"use client";

import Link from "next/link";
import { useState } from "react";
import { FormulationView } from "@/components/lab/FormulationView";
import { RoyBodyView } from "@/components/lab/RoyBodyView";
import { MaterialsView } from "@/components/forms/MaterialsView";
import { StageRowsView } from "@/components/forms/StageRowsView";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { designType } from "@/modules/forms/design-types";
import { bodiesDesignText, veinDetailsText } from "../bodies";
import type { DesignTypeDTO, SampleBodyDTO, SampleDetail } from "../queries";
import { AttachmentCard } from "./AttachmentsField";
import { FileViewer, type ViewableFile } from "./FileViewer";

const TYPE_SECTION: Record<DesignTypeDTO["type"], string> = {
  ROY_BODY: "Roy Body Details",
  KREOS: "Kreos Vein Details",
  CARRARA: "Carrara Details",
  VEIN: "Vein Details",
  CHESSBOARD: "Chessboard Details",
};

/** What a body recorded with the earlier form's Vein / Roy Body parts. */
const bodyHasEarlier = (b: SampleBodyDTO) =>
  b.hasVein !== null || !!b.mixerType || b.veinMethods.length > 0 || b.veinDetails.length > 0 || !!b.veinNotes || !!b.designRoyBody || !!b.veinRoyBody;

/** Review page: everything recorded for a lab sample, in the order of the form. */
export function SampleDetailView({ s }: { s: SampleDetail }) {
  const [viewing, setViewing] = useState<ViewableFile | null>(null);
  let section = 0;
  const next = () => ++section;
  const showBodies = s.plainBody === true || s.designTypes.length > 0 || s.bodies.length > 0;
  const perBodyDesign = s.bodies.length > 1 && new Set(s.bodies.map((b) => `${b.designCategory}|${b.designPatterns.map((p) => p.id).join()}`)).size > 1;
  const earlierBodies = s.bodies.filter(bodyHasEarlier);
  const earlier = s.physicalSamplePresent !== null || !!s.inwardEntry || s.otherPatterns.length > 0 || perBodyDesign || earlierBodies.length > 0;
  const special = (t: DesignTypeDTO["type"]) => (t === "ROY_BODY" ? s.royBodies : t === "CHESSBOARD" ? s.chessboardBodies : []);

  return (
    <div className="space-y-4">
      <Block index={next()} title="Basic Information">
        <Pairs
          items={[
            ["Date", formatDate(s.sampleDate)],
            ["S.No.", s.serialNo],
            ["Slab Number", s.slabNumber],
            ["Design Name", s.designName],
          ]}
        />
        {s.status === "DRAFT" && <p className="mt-3 text-[13px] text-warn-fg">Saved as a draft with the earlier form.</p>}
      </Block>

      <Block index={next()} title="Design Type and Number of Bodies">
        <Pairs
          items={[
            ["Plain Body", s.plainBody === null ? null : s.plainBody ? "Yes" : "No"],
            ...(s.plainBody === false ? ([["Design Types", s.designTypes.map((t) => designType(t.type).label).join(", ")]] as [string, React.ReactNode][]) : []),
            ["Number of Bodies (N)", s.numberOfBodies ?? (s.bodies.length || null)],
          ]}
        />
      </Block>

      {showBodies && (
        <Block index={next()} title="Material Details">
          {s.bodies.length === 0 ? (
            <p className="text-sm text-ink-3">Not recorded.</p>
          ) : (
            <div className="space-y-4">
              {s.legacyBodies && (
                <p className="text-[13px] text-ink-2">Recorded with the earlier form as one set of materials for the whole sample — shown on every body.</p>
              )}
              {s.bodies.map((b) => (
                <Card key={b.index} title={`Body ${b.index}`}>
                  <MaterialsView f={b.main} />
                </Card>
              ))}
            </div>
          )}
        </Block>
      )}

      {s.designTypes.map((t) => (
        <Block key={t.type} index={next()} title={TYPE_SECTION[t.type]}>
          <TypeView t={t} bodies={special(t.type)} />
        </Block>
      ))}

      {showBodies && (
        <Block index={next()} title="L, a, b Measurements">
          <StageRowsView
            rows={[
              ...s.bodies.map((b) => ({ label: `Body ${b.index}`, postPress: b.postPress, postPolish: b.postPolish })),
              ...s.royBodies.map((b) => ({ label: `Roy Body ${b.index}`, postPress: b.postPress, postPolish: b.postPolish })),
              ...s.chessboardBodies.map((b) => ({ label: `Chessboard Body ${b.index}`, postPress: b.postPress, postPolish: b.postPolish })),
            ]}
          />
        </Block>
      )}

      <Block index={next()} title="Sample Output">
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

      <Block index={next()} title="Remarks">
        {s.remarks ? <p className="text-[15px] break-words whitespace-pre-wrap">{s.remarks}</p> : <p className="text-sm text-ink-3">Not recorded.</p>}
      </Block>

      {earlier && (
        <Block index={next()} title="Recorded with the earlier form">
          <div className="space-y-4">
            <Pairs
              items={[
                ["Physical Sample Available?", s.physicalSamplePresent === null ? null : s.physicalSamplePresent ? "Yes" : "No"],
                [
                  "Inward / Outward",
                  s.inwardEntry ? (
                    <Link href={`/inward-outward/${s.inwardEntry.id}`} className="font-semibold text-accent underline">
                      S.No. {s.inwardEntry.serialNo}
                    </Link>
                  ) : null,
                ],
                ...(perBodyDesign
                  ? ([["Design per body", bodiesDesignText(s.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns })))]] as [string, React.ReactNode][])
                  : []),
                ...(s.otherPatterns.length ? ([["Other design patterns", s.otherPatterns.map((p) => p.label).join(", ")]] as [string, React.ReactNode][]) : []),
              ]}
            />
            {earlierBodies.map((b) => (
              <Card key={b.index} title={`Body ${b.index}`} tone="accent">
                <div className="space-y-4">
                  {(b.hasVein !== null || b.mixerType || b.veinMethods.length > 0 || b.veinDetails.length > 0 || b.veinNotes) && (
                    <Pairs
                      items={[
                        ["Vein", b.hasVein === null ? null : b.hasVein ? "Yes" : "No"],
                        ["Mixer Type", b.mixerType?.label],
                        ["How Vein Introduced", b.veinMethods.map((m) => m.label).join(", ")],
                        ["Vein details", veinDetailsText(b.veinDetails, b.veinNotes)],
                      ]}
                    />
                  )}
                  {b.designRoyBody && (
                    <div>
                      <p className="mb-2 text-[13px] font-bold">Roy Body Formulation — Design</p>
                      <RoyBodyView f={b.designRoyBody} />
                    </div>
                  )}
                  {b.veinRoyBody && (
                    <div>
                      <p className="mb-2 text-[13px] font-bold">Roy Body Formulation — Vein</p>
                      <FormulationView f={b.veinRoyBody} />
                    </div>
                  )}
                </div>
              </Card>
            ))}
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

function TypeView({ t, bodies }: { t: DesignTypeDTO; bodies: SampleDetail["royBodies"] }) {
  const def = designType(t.type);
  if (def.special) {
    return (
      <div className="space-y-4">
        <Pairs items={[[def.special.countLabel, t.bodyCount ?? (bodies.length || null)]]} />
        {bodies.map((b) => (
          <Card key={b.index} title={`${def.special!.bodyLabel} ${b.index}`}>
            <MaterialsView f={b.materials} />
          </Card>
        ))}
      </div>
    );
  }
  const vein = t.type === "KREOS" || t.type === "VEIN";
  return (
    <div className="space-y-4">
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
                <td className="td font-semibold">{c.colour.label}</td>
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

function Card({ title, tone = "brand", children }: { title: string; tone?: "brand" | "accent"; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("overflow-hidden rounded-xl border bg-shell", tone === "brand" ? "border-brand/25" : "border-accent/40")}>
      <h3 className={cn("px-4 py-2.5 text-[14px] font-bold tracking-widest text-white uppercase", tone === "brand" ? "bg-brand" : "bg-accent")}>{title}</h3>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function Pairs({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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

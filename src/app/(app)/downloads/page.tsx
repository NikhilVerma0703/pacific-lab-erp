import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { MASTER } from "@/modules/master-data/catalog";
import { FilterForm } from "@/modules/downloads/components/FilterForm";
import { SampleDownload } from "@/modules/downloads/components/SampleDownload";
import { inwardDesignsFor, samplesOn } from "@/modules/downloads/data";
import { applyFilters, filtersToQuery, MATERIAL_KIND_LABEL, parseFilters, type MaterialKind } from "@/modules/downloads/filters";
import { filterLabels } from "@/modules/downloads/labels";
import { formatGrams } from "@/modules/reports/components/format";

export const metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can(user, "downloads.view")) notFound();
  const today = plantToday();
  const q = await searchParams;
  const applied = q.apply === "1";
  const filters = parseFilters(q, today);

  const lists = await prisma.masterValue.findMany({
    where: { category: { code: { in: [MASTER.DESIGN_PATTERN, MASTER.RESIN, MASTER.GRIT, MASTER.FILLER, MASTER.PIGMENT] } } },
    select: { id: true, label: true, isActive: true, category: { select: { code: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  const opts = (code: string) =>
    lists.filter((v) => v.category.code === code).map((v) => ({ id: v.id, label: v.isActive ? v.label : `${v.label} (disabled)` }));
  const materials: Record<MaterialKind, { id: string; label: string }[]> = {
    RESIN: opts(MASTER.RESIN),
    GRIT: opts(MASTER.GRIT),
    FILLER: opts(MASTER.FILLER),
    PIGMENT: opts(MASTER.PIGMENT),
  };

  let results: ReturnType<typeof applyFilters> | null = null;
  let labels: Record<string, string> = {};
  if (applied) {
    const samples = await samplesOn(filters.date);
    results = applyFilters(samples, await inwardDesignsFor(samples), filters);
    labels = await filterLabels(filters);
  }
  const mk = filters.materialKind;
  const total = results?.reduce((a, r) => a + (r.consumption?.grams ?? 0), 0) ?? 0;
  const pct = results?.reduce((a, r) => a + (r.consumption?.percentEntries ?? 0), 0) ?? 0;
  const chips = [
    labels.sampleType,
    labels.design,
    labels.pattern && `Pattern: ${labels.pattern}`,
    mk && `${MATERIAL_KIND_LABEL[mk]}${labels.material ? `: ${labels.material}` : " (all)"}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Downloads" description="Download lab records as Excel (.xlsx) — by date, or filtered." />

      {/* 1 · Sample Data Download */}
      <section className="card mb-8" aria-labelledby="dl-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="dl-h" className="text-[15px] font-bold">1 · Sample Data Download</h2>
          <p className="text-[13px] text-ink-2">Pick a date and what to download.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <SampleDownload today={today} />
        </div>
      </section>

      {/* 2 · Filtered Data Export */}
      <section id="filtered" className="card scroll-mt-20" aria-labelledby="fx-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="fx-h" className="text-[15px] font-bold">2 · Filtered Data Export</h2>
          <p className="text-[13px] text-ink-2">Choose a date and filters, Apply to see the matching samples, then export exactly those.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <FilterForm key={filtersToQuery(filters)} today={today} initial={filters} patterns={opts(MASTER.DESIGN_PATTERN)} materials={materials} />
        </div>

        {results && (
          <div className="border-t border-line">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">
                  {results.length} sample{results.length === 1 ? "" : "s"} on {formatDate(filters.date)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {chips.length ? (
                    chips.map((c) => (
                      <span key={c} className="badge bg-info-bg text-info-fg">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-ink-3">No filters — every sample of the date.</span>
                  )}
                </div>
              </div>
              {mk && (
                <div className="rounded-lg bg-accent-bg px-4 py-2">
                  <p className="text-[11px] font-bold tracking-wide text-accent uppercase">
                    {labels.material ?? MATERIAL_KIND_LABEL[mk]} consumed
                  </p>
                  <p className="text-xl font-bold tabular-nums">{formatGrams(total)}</p>
                  {pct > 0 && <p className="text-[11px] text-ink-3">+ {pct} entr{pct === 1 ? "y" : "ies"} in % (not a weight)</p>}
                </div>
              )}
              <a
                href={`/api/downloads?kind=filtered&${filtersToQuery(filters)}`}
                className={`btn-primary ${results.length ? "" : "pointer-events-none opacity-50"}`}
                aria-disabled={!results.length}
                download
              >
                <Download className="size-4" /> Download / Export Excel
              </a>
            </div>

            {results.length === 0 ? (
              <p className="px-5 pb-8 text-center text-sm text-ink-3">No samples match these filters on this date.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr>
                        <th className="th">S.No.</th>
                        <th className="th">Slab</th>
                        <th className="th">Sample Type</th>
                        <th className="th">Design</th>
                        <th className="th">Design Pattern(s)</th>
                        <th className="th">Mixer</th>
                        {mk && <th className="th text-right">Consumed</th>}
                        {mk && <th className="th">{MATERIAL_KIND_LABEL[mk]} used</th>}
                        <th className="th">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.sample.id} className="hover:bg-mute-bg/50">
                          <td className="td font-semibold tabular-nums">
                            {r.sample.serialNo}
                            {r.sample.status === "DRAFT" && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                          </td>
                          <td className="td tabular-nums">{r.sample.slabNumber ?? "—"}</td>
                          <td className="td">{r.sample.sampleType?.label ?? "—"}</td>
                          <td className="td">
                            {r.design.designCategory === "PLAIN_BODY" ? "Plain Body" : r.design.designCategory === "NON_PLAIN_BODY" ? "Non-Plain Body" : "—"}
                            {r.design.source === "inward" && <span className="block text-[11px] text-ink-3">from Inward / Outward</span>}
                          </td>
                          <td className="td">{r.design.patterns.map((p) => p.label).join(", ") || "—"}</td>
                          <td className="td">{r.sample.mixerType?.label ?? "—"}</td>
                          {mk && <td className="td text-right font-semibold tabular-nums">{formatGrams(r.consumption?.grams ?? 0)}</td>}
                          {mk && <td className="td max-w-[260px] text-[13px] text-ink-2">{r.consumption?.detail || "—"}</td>}
                          <td className="td">
                            <Link href={`/samples/${r.sample.id}`} className="btn-secondary btn-sm whitespace-nowrap">
                              <FileSearch className="size-3.5" /> View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-line md:hidden">
                  {results.map((r) => (
                    <li key={r.sample.id} className="space-y-1 px-4 py-3 text-[14px]">
                      <p className="font-bold">
                        S.No. {r.sample.serialNo}
                        <span className="ml-2 font-normal text-ink-3">Slab {r.sample.slabNumber ?? "—"}</span>
                      </p>
                      <p className="text-ink-2">
                        {r.sample.sampleType?.label ?? "—"} · {r.design.patterns.map((p) => p.label).join(", ") || (r.design.designCategory === "PLAIN_BODY" ? "Plain Body" : "No design")}
                      </p>
                      {mk && (
                        <p>
                          <strong className="tabular-nums">{formatGrams(r.consumption?.grams ?? 0)}</strong>{" "}
                          <span className="text-[13px] text-ink-2">{r.consumption?.detail}</span>
                        </p>
                      )}
                      <Link href={`/samples/${r.sample.id}`} className="btn-secondary btn-sm mt-1">
                        <FileSearch className="size-3.5" /> View
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}

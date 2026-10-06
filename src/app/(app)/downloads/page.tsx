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
import { ProductionDownload } from "@/modules/downloads/components/ProductionDownload";
import { SampleDownload } from "@/modules/downloads/components/SampleDownload";
import { inwardDesignsFor, productionIn, samplesIn } from "@/modules/downloads/data";
import { applyFilters, filtersToQuery, parseFilters, wantsLab, wantsProduction } from "@/modules/downloads/filters";
import { filterLabels } from "@/modules/downloads/labels";
import { periodLabel } from "@/modules/downloads/period";
import { unionLabels } from "@/modules/samples/bodies";

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

  const canProduction = can(user, "production.view");
  // Production Samples only for users who may see them.
  if (!canProduction && filters.sampleType === "PRODUCTION") filters.sampleType = "";

  const patternValues = await prisma.masterValue.findMany({
    where: { category: { code: MASTER.DESIGN_PATTERN } },
    select: { id: true, label: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  const patterns = patternValues.map((v) => ({ id: v.id, label: v.isActive ? v.label : `${v.label} (disabled)` }));

  let results: ReturnType<typeof applyFilters> | null = null;
  let labels: Record<string, string> = {};
  if (applied) {
    const [samples, productions] = await Promise.all([
      wantsLab(filters) ? samplesIn(filters.period) : [],
      wantsProduction(filters) && canProduction ? productionIn(filters.period) : [],
    ]);
    results = applyFilters(samples, await inwardDesignsFor(samples), productions, filters);
    labels = await filterLabels(filters);
  }
  const chips = [labels.sampleType, labels.design, labels.pattern && `Pattern: ${labels.pattern}`].filter(Boolean) as string[];
  const designText = (d: { categories: string[] }) =>
    d.categories.map((c) => (c === "PLAIN_BODY" ? "Plain Body" : "Non-Plain Body")).join(", ") || "—";
  const href = (r: NonNullable<typeof results>[number]) => (r.source === "lab" ? `/samples/${r.id}` : `/production-sample/${r.id}`);
  const draft = (r: NonNullable<typeof results>[number]) => r.source === "lab" && r.sample.status === "DRAFT";
  const mixer = (r: NonNullable<typeof results>[number]) =>
    r.source === "lab" ? unionLabels(r.sample.bodies.map((b) => (b.mixerType ? [b.mixerType] : []))).join(", ") || "—" : "—";

  return (
    <>
      <PageHeader title="Downloads" description="Download lab records as Excel (.xlsx) — by Production Date, or filtered." />

      {/* 1 · Sample Data Download */}
      <section className="card mb-8" aria-labelledby="dl-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="dl-h" className="text-[15px] font-bold">1 · Sample Data Download</h2>
          <p className="text-[13px] text-ink-2">Pick the Production Date and what to download.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <SampleDownload today={today} />
        </div>
      </section>

      {/* 2 · Production Sample Data Download */}
      {can(user, "production.view") && (
        <section className="card mb-8" aria-labelledby="pdl-h">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 id="pdl-h" className="text-[15px] font-bold">2 · Production Sample Data Download</h2>
            <p className="text-[13px] text-ink-2">Pick the Production Date to download its production samples.</p>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <ProductionDownload today={today} />
          </div>
        </section>
      )}

      {/* 3 · Filtered Data Export */}
      <section id="filtered" className="card scroll-mt-20" aria-labelledby="fx-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="fx-h" className="text-[15px] font-bold">3 · Filtered Data Export</h2>
          <p className="text-[13px] text-ink-2">Choose the Production Date and filters, Apply to see the matching samples, then export exactly those.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <FilterForm key={filtersToQuery(filters)} today={today} initial={filters} patterns={patterns} showProduction={canProduction} />
        </div>

        {results && (
          <div className="border-t border-line">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">
                  {results.length} sample{results.length === 1 ? "" : "s"} · {periodLabel(filters.period)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {chips.length ? (
                    chips.map((c) => (
                      <span key={c} className="badge bg-info-bg text-info-fg">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-ink-3">No filters — every sample of the Production Date.</span>
                  )}
                </div>
              </div>
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
              <p className="px-5 pb-8 text-center text-sm text-ink-3">No samples match these filters for this Production Date.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr>
                        <th className="th">S.No.</th>
                        <th className="th">Date</th>
                        <th className="th">Slab</th>
                        <th className="th">Sample Type</th>
                        <th className="th">Design</th>
                        <th className="th">Design Pattern(s)</th>
                        <th className="th">Mixer</th>
                        <th className="th">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={`${r.source}-${r.id}`} className="hover:bg-mute-bg/50">
                          <td className="td font-semibold tabular-nums">
                            {r.serialNo}
                            {draft(r) && <span className="badge ml-2 bg-warn-bg text-warn-fg">Draft</span>}
                          </td>
                          <td className="td whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className="td tabular-nums">{r.slabNumber ?? "—"}</td>
                          <td className="td">
                            {r.source === "production" ? <span className="badge bg-accent-bg text-accent">{r.typeLabel}</span> : r.typeLabel}
                          </td>
                          <td className="td">
                            {designText(r.design)}
                            {r.design.source === "inward" && <span className="block text-[11px] text-ink-3">from Inward / Outward</span>}
                          </td>
                          <td className="td">{r.design.patterns.map((p) => p.label).join(", ") || "—"}</td>
                          <td className="td">{mixer(r)}</td>
                          <td className="td">
                            <Link href={href(r)} className="btn-secondary btn-sm whitespace-nowrap">
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
                    <li key={`${r.source}-${r.id}`} className="space-y-1 px-4 py-3 text-[14px]">
                      <p className="font-bold">
                        S.No. {r.serialNo}
                        <span className="ml-2 font-normal text-ink-3">
                          Slab {r.slabNumber ?? "—"} · {formatDate(r.date)}
                        </span>
                      </p>
                      <p className="text-ink-2">
                        {r.typeLabel} · {r.design.patterns.map((p) => p.label).join(", ") || (r.design.categories.includes("PLAIN_BODY") ? "Plain Body" : "No design")}
                      </p>
                      <Link href={href(r)} className="btn-secondary btn-sm mt-1">
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

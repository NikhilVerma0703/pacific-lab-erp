import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { FilterForm } from "@/modules/downloads/components/FilterForm";
import { SampleDownload } from "@/modules/downloads/components/SampleDownload";
import { filterOptions, filterSource } from "@/modules/downloads/data";
import { applyFilters, filterLabels, filtersToQuery, parseFilters, SAMPLE_TYPE_OPTIONS, sampleTypeOption, type FilteredRow } from "@/modules/downloads/filters";
import { periodLabel } from "@/modules/downloads/period";

export const metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

const REVIEW: Record<FilteredRow["source"], string> = { LAB: "/samples", INWARD: "/inward-outward", PRODUCTION: "/production-sample" };

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can(user, "downloads.view")) notFound();
  const today = plantToday();
  const q = await searchParams;
  const applied = q.apply === "1";
  const filters = parseFilters(q, today);

  // Each report only for users who may see that form.
  const types = SAMPLE_TYPE_OPTIONS.filter((o) => can(user, o.permission)).map((o) => o.value);
  if (!types.includes(filters.sampleType) && types.length) filters.sampleType = types[0];

  const options = await filterOptions();
  let results: FilteredRow[] | null = null;
  if (applied && types.includes(filters.sampleType)) {
    results = applyFilters(await filterSource(filters.sampleType, filters.period), filters);
  }
  const labels = filterLabels(filters);
  const chips = [labels.sampleType, filters.sampleDesign && `Sample Design: ${filters.sampleDesign}`, filters.designType && `Design Type: ${filters.designType}`].filter(
    Boolean,
  ) as string[];
  const record = sampleTypeOption(filters.sampleType).record;
  const href = (r: FilteredRow) => `${REVIEW[r.source]}/${r.id}`;
  const draft = (r: FilteredRow) => r.source === "LAB" && r.sample.status === "DRAFT";
  const noun = (n: number) => `${n} record${n === 1 ? "" : "s"}`;

  return (
    <>
      <PageHeader title="Downloads" description="Download Lab Sample, Sample Inward / Outward and Production Sample records as Excel (.xlsx) — by Production Date, or filtered." />

      {/* 1 · Sample Data Download */}
      <section className="card mb-8" aria-labelledby="dl-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="dl-h" className="text-[15px] font-bold">1 · Sample Data Download</h2>
          <p className="text-[13px] text-ink-2">Pick the Production Date and the report — each one has the complete data of its form.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <SampleDownload today={today} types={types} />
        </div>
      </section>

      {/* 2 · Filtered Data Export */}
      <section id="filtered" className="card scroll-mt-20" aria-labelledby="fx-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="fx-h" className="text-[15px] font-bold">2 · Filtered Data Export</h2>
          <p className="text-[13px] text-ink-2">Choose the Production Date, the Sample Type and any filters, Apply to see the matching records, then export exactly those.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <FilterForm key={filtersToQuery(filters)} today={today} initial={filters} types={types} sampleDesigns={options.sampleDesigns} designTypes={options.designTypes} />
        </div>

        {results && (
          <div className="border-t border-line">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">
                  {noun(results.length)} · {periodLabel(filters.period)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {chips.length ? (
                    chips.map((c) => (
                      <span key={c} className="badge bg-info-bg text-info-fg">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-ink-3">No filters — every record of the Production Date.</span>
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
              <p className="px-5 pb-8 text-center text-sm text-ink-3">No records match these filters for this Production Date.</p>
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
                        <th className="th">Sample Design</th>
                        <th className="th">Design Type</th>
                        <th className="th">Number of Bodies</th>
                        <th className="th">Review</th>
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
                          <td className="td">{record}</td>
                          <td className="td">{r.designName ?? "—"}</td>
                          <td className="td">{r.designTypes.join(", ") || "—"}</td>
                          <td className="td tabular-nums">{r.numberOfBodies ?? "—"}</td>
                          <td className="td">
                            <Link href={href(r)} className="btn-secondary btn-sm whitespace-nowrap">
                              <FileSearch className="size-3.5" /> Review
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
                        {r.designName ?? "No design name"} · {r.designTypes.join(", ") || "No design type"}
                      </p>
                      <Link href={href(r)} className="btn-secondary btn-sm mt-1">
                        <FileSearch className="size-3.5" /> Review
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

import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { FilterForm } from "@/modules/downloads/components/FilterForm";
import { RecordsTable } from "@/modules/downloads/components/RecordsTable";
import { ReportSearchForm } from "@/modules/downloads/components/ReportSearchForm";
import { filterOptions, filterSource } from "@/modules/downloads/data";
import {
  applyFilters,
  filterLabels,
  filtersToQuery,
  parseFilters,
  parseReportSearch,
  reportDownloadQuery,
  reportQueryString,
  SAMPLE_TYPE_OPTIONS,
  sampleTypeOption,
  type FilteredRow,
} from "@/modules/downloads/filters";
import { periodLabel } from "@/modules/downloads/period";

export const metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

/** A long list stays readable on the page; the Excel always holds every record. */
const LIMIT = 200;
const noun = (n: number) => `${n} record${n === 1 ? "" : "s"}`;

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  if (!can(user, "downloads.view")) notFound();
  const today = plantToday();
  const q = await searchParams;

  // Each report only for users who may see that form.
  const types = SAMPLE_TYPE_OPTIONS.filter((o) => can(user, o.permission)).map((o) => o.value);
  const allowed = (t: (typeof types)[number]) => types.includes(t);

  // 1 · Sample Data Download — its own keys ("d…"), so both searches share the page.
  const report = parseReportSearch(q, today);
  if (!allowed(report.sampleType) && types.length) report.sampleType = types[0];
  const searched = q.show === "1" && allowed(report.sampleType);
  const reportRows = searched
    ? applyFilters(await filterSource(report.sampleType, report.period), { period: report.period, sampleType: report.sampleType, sampleDesign: "", designType: "" })
    : null;
  const reportRecord = sampleTypeOption(report.sampleType).record;

  // 2 · Filtered Data Export
  const filters = parseFilters(q, today);
  if (!allowed(filters.sampleType) && types.length) filters.sampleType = types[0];
  const options = await filterOptions();
  const results = q.apply === "1" && allowed(filters.sampleType) ? applyFilters(await filterSource(filters.sampleType, filters.period), filters) : null;
  const labels = filterLabels(filters);
  const chips = [labels.sampleType, filters.sampleDesign && `Sample Design: ${filters.sampleDesign}`, filters.designType && `Design Type: ${filters.designType}`].filter(
    Boolean,
  ) as string[];
  const filterRecord = sampleTypeOption(filters.sampleType).record;

  /** What the Excel will hold, said once below each results header. */
  const note = (rows: FilteredRow[], record: string) =>
    rows.length > LIMIT
      ? `The first ${LIMIT} are listed below; the Excel holds all ${rows.length}, with the complete ${record} form data.`
      : `The Excel holds exactly ${rows.length === 1 ? "this record" : "these records"}, with the complete ${record} form data.`;

  return (
    <>
      <PageHeader title="Downloads" description="Download Lab Sample, Sample Inward / Outward and Production Sample records as Excel (.xlsx) — by Production Date, or filtered." />

      {/* 1 · Sample Data Download */}
      <section id="report" className="card mb-8 scroll-mt-20" aria-labelledby="dl-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="dl-h" className="text-[15px] font-bold">1 · Sample Data Download</h2>
          <p className="text-[13px] text-ink-2">
            Pick the Production Date and the report, Search to list its records, then download them — each report has the complete data of its form.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <ReportSearchForm key={reportQueryString(report)} today={today} initial={report} types={types} />
        </div>

        {reportRows && (
          <div id="report-results" className="scroll-mt-20 border-t border-line" aria-labelledby="report-results-h">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <h3 id="report-results-h" className="text-[15px] font-bold">
                  {reportRecord} records — {noun(reportRows.length)} · {periodLabel(report.period)}
                </h3>
                <p className="mt-1 text-[13px] text-ink-2">{reportRows.length ? note(reportRows, reportRecord) : "Nothing was recorded on this Production Date."}</p>
              </div>
              <a
                href={`/api/downloads?${reportDownloadQuery(report)}`}
                className={`btn-primary shrink-0 ${reportRows.length ? "" : "pointer-events-none opacity-50"}`}
                aria-disabled={!reportRows.length}
                download
              >
                <Download className="size-4" /> Download Excel
              </a>
            </div>
            {reportRows.length > 0 && <RecordsTable rows={reportRows.slice(0, LIMIT)} record={reportRecord} />}
          </div>
        )}
      </section>

      {/* 2 · Filtered Data Export */}
      <section id="filtered" className="card scroll-mt-20" aria-labelledby="fx-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="fx-h" className="text-[15px] font-bold">2 · Filtered Data Export</h2>
          <p className="text-[13px] text-ink-2">Choose the Production Date, the Sample Type and any filters, Search to list the matching records, then export exactly those to Excel.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <FilterForm key={filtersToQuery(filters)} today={today} initial={filters} types={types} sampleDesigns={options.sampleDesigns} designTypes={options.designTypes} />
        </div>

        {results && (
          <div id="results" className="scroll-mt-20 border-t border-line" aria-labelledby="results-h">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <h3 id="results-h" className="text-[15px] font-bold">
                  Matching records — {noun(results.length)} · {periodLabel(filters.period)}
                </h3>
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
                className={`btn-primary shrink-0 ${results.length ? "" : "pointer-events-none opacity-50"}`}
                aria-disabled={!results.length}
                download
              >
                <Download className="size-4" /> Download / Export Excel
              </a>
            </div>
            {results.length > 0 && <p className="px-4 pb-3 text-[13px] text-ink-2 sm:px-5">{note(results, filterRecord)}</p>}

            {results.length === 0 ? (
              <p className="px-5 pb-8 text-center text-sm text-ink-3">No records match these filters for this Production Date.</p>
            ) : (
              <RecordsTable rows={results.slice(0, LIMIT)} record={filterRecord} />
            )}
          </div>
        )}
      </section>
    </>
  );
}

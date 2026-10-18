import { notFound } from "next/navigation";
import { Palette, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { filterOptions } from "@/modules/downloads/data";
import { periodLabel } from "@/modules/downloads/period";
import { ensureRecordStores } from "@/modules/records/sync";
import { MeasurementSearchForm } from "@/modules/slab-records/components/MeasurementSearchForm";
import { ParameterSearchForm } from "@/modules/slab-records/components/ParameterSearchForm";
import { MeasurementResults, ParameterResults } from "@/modules/slab-records/components/SlabResults";
import { hasAnyFilter, searchByMeasurement, searchByParameter } from "@/modules/slab-records/queries";
import { parseMeasurementSearch, parseParameterSearch, TOLERANCE, type Query } from "@/modules/slab-records/search";

export const metadata = { title: "Slab Records" };
export const dynamic = "force-dynamic";

const count = (n: number) => `${n} ${n === 1 ? "match" : "matches"}`;

export default async function SlabRecordsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireUser();
  if (!can(user, "slab.view")) notFound();
  await ensureRecordStores();
  const today = plantToday();
  const q = await searchParams;
  const find = Array.isArray(q.find) ? q.find[0] : q.find;

  const measurement = parseMeasurementSearch(q);
  const parameter = parseParameterSearch(q, today);
  const filters = { period: parameter.period, slabNumber: parameter.slabNumber, designName: parameter.designName };

  const matches = find === "lab" && measurement.values ? await searchByMeasurement(measurement.values) : null;
  const records = find === "any" && !parameter.problem ? await searchByParameter(filters) : null;
  const { sampleDesigns } = await filterOptions();

  const applied = [
    parameter.period ? `Production Date: ${periodLabel(parameter.period)}` : null,
    parameter.slabNumber !== null ? `Slab Number: ${parameter.slabNumber}` : null,
    parameter.designName ? `Design Name: ${parameter.designName}` : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Slab Records"
        description="Find a slab that was made before — by its L, a, b measurements, or by date, slab number and design name — across all three forms."
      />

      {/* A · by L, a, b */}
      <section className="card mb-8" aria-labelledby="by-lab-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="by-lab-h" className="flex items-center gap-2 text-[15px] font-bold">
            <Palette className="size-4 text-accent" aria-hidden="true" /> A · Search a Slab by L, a, b Measurements
          </h2>
          <p className="text-[13px] text-ink-2">
            Every saved reading of the three forms — Post Polish where the form has one. A slab matches when its L, a and b are each within ±{TOLERANCE} of the
            values entered; the nearest come first.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <MeasurementSearchForm initial={measurement.raw} />
          {measurement.problem && (
            <p className="mt-3 text-[13px] text-bad-fg" role="alert">
              {measurement.problem}
            </p>
          )}
        </div>

        {matches && measurement.values && (
          <div id="lab-results" className="scroll-mt-20 border-t border-line">
            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-[15px] font-bold">
                {count(matches.length)} for L {measurement.values.l}, a {measurement.values.a}, b {measurement.values.b}
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {matches.length
                  ? "Nearest first — Difference adds up how far L, a and b are from the values entered."
                  : `No slab recorded so far is within ±${TOLERANCE} of all three values. Try widening one of them.`}
              </p>
            </div>
            {matches.length > 0 && <MeasurementResults rows={matches} target={measurement.values} />}
          </div>
        )}
      </section>

      {/* B · by any parameter */}
      <section className="card" aria-labelledby="by-any-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="by-any-h" className="flex items-center gap-2 text-[15px] font-bold">
            <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" /> B · Search a Slab by Any Parameter
          </h2>
          <p className="text-[13px] text-ink-2">Production Date, Slab Number and Design Name — any one of them, or all together.</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <ParameterSearchForm today={today} initial={{ period: parameter.period, slab: parameter.rawSlab, design: parameter.designName }} designNames={sampleDesigns} />
          {parameter.problem && (
            <p className="mt-3 text-[13px] text-bad-fg" role="alert">
              {parameter.problem}
            </p>
          )}
        </div>

        {records && (
          <div id="any-results" className="scroll-mt-20 border-t border-line">
            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-[15px] font-bold">
                {records.length} {records.length === 1 ? "record" : "records"}
              </h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {applied.length ? (
                  applied.map((c) => (
                    <span key={c} className="badge bg-info-bg text-info-fg">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-ink-3">No filters — every saved record of the three forms, newest first.</span>
                )}
              </div>
              {records.length === 0 && hasAnyFilter(filters) && <p className="mt-2 text-[13px] text-ink-2">Nothing matches all of these filters.</p>}
            </div>
            {records.length > 0 && <ParameterResults rows={records} />}
          </div>
        )}
      </section>
    </>
  );
}

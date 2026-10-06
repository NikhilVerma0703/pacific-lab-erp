import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { parseRange, REPORT_RANGES } from "@/modules/reports/build";
import { getReport } from "@/modules/reports/queries";
import {
  ConsumptionChart,
  CreativeInspiredChart,
  DesignChart,
  ProductionChart,
  ProductionSamplesChart,
} from "@/modules/reports/components/Charts";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  if (!can(user, "reports.view")) notFound();
  const days = parseRange((await searchParams).range);
  const data = await getReport(days);
  const activeDays = data.production.filter((d) => d.count > 0).length;

  const kpis = [
    { label: "Samples created", value: data.totals.samples },
    { label: "Creative", value: data.totals.creative },
    { label: "Inspired", value: data.totals.inspired },
    { label: "Days with samples", value: `${activeDays} / ${days}` },
    { label: "Production samples", value: data.totals.productionSamples },
  ];

  return (
    <>
      <PageHeader title="Reports" description="Lab activity for the selected period. Every chart below follows the date range." />

      {/* 1 · Filters */}
      <div className="card mb-5 flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          <CalendarRange className="size-4" /> Date range
        </div>
        <nav aria-label="Date range" className="flex rounded-lg border border-line-2 p-0.5">
          {REPORT_RANGES.map((r) => (
            <Link
              key={r}
              href={`/reports?range=${r}`}
              scroll={false}
              aria-current={r === days ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 flex-1 items-center justify-center rounded-md px-4 text-[14px] font-semibold whitespace-nowrap sm:flex-none",
                r === days ? "bg-brand text-white" : "text-ink-2 hover:bg-mute-bg",
              )}
            >
              Last {r} Days
            </Link>
          ))}
        </nav>
        <p className="text-[13px] text-ink-3 sm:ml-auto">
          {formatDate(data.from)} – {formatDate(data.to)}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card px-4 py-3">
            <p className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ProductionChart data={data} />
        <CreativeInspiredChart data={data} />
        <div className="xl:col-span-2">
          <ProductionSamplesChart data={data} />
        </div>
        <div className="xl:col-span-2">
          <DesignChart data={data} />
        </div>
        <div className="xl:col-span-2">
          <ConsumptionChart data={data} />
        </div>
      </div>

    </>
  );
}

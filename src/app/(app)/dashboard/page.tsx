import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { OverallKpis } from "@/modules/dashboard/components/OverallKpis";
import { TodayPanel } from "@/modules/dashboard/components/TodayPanel";
import { getDashboard } from "@/modules/dashboard/queries";
import { ensureRecordStores } from "@/modules/records/sync";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[13px] font-bold tracking-widest text-ink-2 uppercase">{children}</h2>
      {aside && <span className="text-[13px] text-ink-3">{aside}</span>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  // Records saved before the Lab Sample / Inward-Outward databases existed get their copy (once per server start).
  await ensureRecordStores();
  if (!can(user, "dashboard.view")) notFound();
  const data = await getDashboard();
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.today}T00:00:00Z`));

  return (
    <>
      <div className="mb-6">
        <p className="text-[13px] font-semibold text-ink-3">{todayLabel}</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome, {user.name}</h1>
      </div>

      <section aria-label="Today's information" className="mb-8">
        <SectionTitle aside="Samples dated today">Today&apos;s Information</SectionTitle>
        <TodayPanel data={data.todayStats} />
      </section>

      <section aria-label="Overall information" className="mb-8">
        <SectionTitle aside="All records in the ERP">Overall Information</SectionTitle>
        <OverallKpis data={data.overall} />
      </section>
    </>
  );
}

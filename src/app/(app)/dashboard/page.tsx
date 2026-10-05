import { notFound } from "next/navigation";
import { Megaphone, Star } from "lucide-react";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { listAnnouncements } from "@/modules/dashboard/announcements";
import { Announcements } from "@/modules/dashboard/components/Announcements";
import { OverallKpis } from "@/modules/dashboard/components/OverallKpis";
import { TodayPanel } from "@/modules/dashboard/components/TodayPanel";
import { getDashboard } from "@/modules/dashboard/queries";

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
  if (!can(user, "dashboard.view")) notFound();
  const [data, announcements] = await Promise.all([getDashboard(), listAnnouncements()]);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.today}T00:00:00Z`));
  const top = announcements[0];

  return (
    <>
      <div className="mb-6">
        <p className="text-[13px] font-semibold text-ink-3">{todayLabel}</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome, {user.name}</h1>
      </div>

      {/* The newest / important instruction is the first thing a lab user sees. */}
      {top && (
        <a
          href="#announcements"
          className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
            top.important ? "border-bad-fg/30 bg-bad-bg hover:bg-bad-bg/70" : "border-info-fg/20 bg-info-bg hover:bg-info-bg/70"
          }`}
        >
          {top.important ? <Star className="mt-0.5 size-5 shrink-0 fill-bad-fg text-bad-fg" /> : <Megaphone className="mt-0.5 size-5 shrink-0 text-info-fg" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{top.title}</span>
            <span className="block truncate text-[13px] text-ink-2">
              {top.createdBy ?? "—"} · {formatDateTime(top.createdAt)}
              {announcements.length > 1 ? ` · ${announcements.length - 1} more` : ""}
            </span>
          </span>
          <span className="hidden text-[13px] font-semibold text-brand-2 sm:block">View →</span>
        </a>
      )}

      <section aria-label="Today's information" className="mb-8">
        <SectionTitle aside="Samples dated today">Today&apos;s Information</SectionTitle>
        <TodayPanel data={data.todayStats} />
      </section>

      <section aria-label="Overall information" className="mb-8">
        <SectionTitle aside="All records in the ERP">Overall Information</SectionTitle>
        <OverallKpis data={data.overall} />
      </section>

      <Announcements
        items={announcements}
        canPublish={can(user, "announcement.publish")}
        userId={user.id}
        isAdmin={user.role === "ADMIN"}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { MessagesSquare, Star } from "lucide-react";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { OverallKpis } from "@/modules/dashboard/components/OverallKpis";
import { TodayPanel } from "@/modules/dashboard/components/TodayPanel";
import { getDashboard } from "@/modules/dashboard/queries";
import { Forum } from "@/modules/forum/components/Forum";
import { POST_KIND_LABEL } from "@/modules/forum/kinds";
import { listForumPosts } from "@/modules/forum/queries";

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
  const [data, posts] = await Promise.all([getDashboard(), listForumPosts()]);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.today}T00:00:00Z`));
  // Posts arrive open-first (Important pinned), so the first open one leads.
  const active = posts.filter((p) => p.status !== "COMPLETED");
  const top = active[0];
  const replies = top?.replies.length ?? 0;

  return (
    <>
      <div className="mb-6">
        <p className="text-[13px] font-semibold text-ink-3">{todayLabel}</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome, {user.name}</h1>
      </div>

      {/* The open / important Forum post is the first thing a lab user sees. */}
      {top && (
        <a
          href="#forum"
          className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
            top.important ? "border-bad-fg/30 bg-bad-bg hover:bg-bad-bg/70" : "border-info-fg/20 bg-info-bg hover:bg-info-bg/70"
          }`}
        >
          {top.important ? (
            <Star className="mt-0.5 size-5 shrink-0 fill-bad-fg text-bad-fg" />
          ) : (
            <MessagesSquare className="mt-0.5 size-5 shrink-0 text-info-fg" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{top.title}</span>
            <span className="block truncate text-[13px] text-ink-2">
              {POST_KIND_LABEL[top.kind]} · {top.author} · {formatDateTime(top.createdAt)}
              {replies > 0 ? ` · ${replies} ${replies === 1 ? "reply" : "replies"}` : ""}
              {active.length > 1 ? ` · ${active.length - 1} more open` : ""}
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

      <Forum
        posts={posts}
        userId={user.id}
        isAdmin={user.role === "ADMIN"}
        canPost={can(user, "forum.post")}
        canReply={can(user, "forum.reply")}
        canStatus={can(user, "forum.status")}
      />
    </>
  );
}

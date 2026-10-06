import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { InwardForm } from "@/modules/inward-outward/components/InwardForm";
import { InwardRecentEntries } from "@/modules/inward-outward/components/InwardRecentEntries";
import { RectificationList } from "@/modules/inward-outward/components/RectificationList";
import { getLinkableSample, getRecentInward, getRectification } from "@/modules/inward-outward/queries";
import { newInwardInput } from "@/modules/inward-outward/schema";
import { nextInwardSerial } from "@/modules/inward-outward/service";
import { prisma } from "@/lib/db";
import { plantToday } from "@/lib/plant-time";

export const metadata = { title: "Sample Inward / Outward" };
export const dynamic = "force-dynamic";

export default async function InwardOutwardPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string; rectification?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "inward.view")) notFound();
  const { sample: sampleId, rectification: rectifiedId } = await searchParams;

  // Arriving from Sample Data Entry with Physical Sample Available? = Yes.
  const linked = sampleId ? await getLinkableSample(sampleId) : null;
  if (linked?.existingEntryId) redirect(`/inward-outward/${linked.existingEntryId}/edit`);

  const canCreate = can(user, "inward.create");
  const [options, serialNo, recent, rectification] = await Promise.all([
    getMasterOptions(),
    nextInwardSerial(prisma),
    getRecentInward(10),
    getRectification(),
  ]);

  // Arriving from Sample Data Entry with Physical Sample Available? = No.
  const justMarked = rectifiedId ? (rectification.find((r) => r.id === rectifiedId) ?? null) : null;

  const nav = [
    { href: "#entry", label: "1 · Data Entry" },
    { href: "#recent", label: "2 · Recent Entries", count: recent.length },
    { href: "#rectification", label: "3 · Rectification", count: rectification.length },
  ];

  return (
    <>
      <PageHeader
        title="Sample Inward / Outward"
        description="Physical samples from companies, their L/a/b values and design, and what the lab tried to recreate."
      />

      <nav aria-label="Subsections" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {nav.map((n) => (
          <a key={n.href} href={n.href} className="btn-secondary btn-sm shrink-0 whitespace-nowrap">
            {n.label}
            {n.count !== undefined && <span className="badge bg-mute-bg text-mute-fg">{n.count}</span>}
          </a>
        ))}
      </nav>

      <section id="entry" className="scroll-mt-20" aria-labelledby="entry-h">
        <h2 id="entry-h" className="mb-3 text-lg font-bold">Inward / Outward Sample Data Entry</h2>
        {canCreate ? (
          <InwardForm
            key={linked?.id ?? "new"}
            mode="create"
            defaults={newInwardInput({ serialNo, today: plantToday(), labSampleId: linked?.id ?? null })}
            linkedSample={linked}
            options={options}
            canOverrideNumbers={can(user, "inward.overrideNumbers")}
            canAddMaster={can(user, "master.addFromForm")}
          />
        ) : (
          <p className="card p-5 text-sm text-ink-2">Your role can view entries but not create them.</p>
        )}
      </section>

      <section id="recent" className="card mt-8 scroll-mt-20" aria-labelledby="recent-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="recent-h" className="text-[15px] font-bold">Recent Entries</h2>
          <p className="text-[13px] text-ink-2">The last 10 saved inward / outward entries</p>
        </div>
        <InwardRecentEntries rows={recent} canEdit={can(user, "inward.edit")} canDelete={can(user, "inward.delete")} />
      </section>

      <section id="rectification" className="card mt-8 scroll-mt-20" aria-labelledby="rect-h">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 id="rect-h" className="text-[15px] font-bold">Rectification</h2>
          <p className="text-[13px] text-ink-2">
            Lab samples saved with <strong>Physical Sample Available? = No</strong>. When the sample arrives, use “Sample received”.
          </p>
        </div>
        {justMarked && (
          <p role="status" className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-warn-fg/30 bg-warn-bg px-4 py-3 text-[14px] text-warn-fg sm:mx-5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Lab sample <strong>S.No. {justMarked.serialNo}</strong>
              {justMarked.slabNumber ? ` (Slab ${justMarked.slabNumber})` : ""} was saved with Physical Sample Available? = No. It is
              listed below, marked <strong>Awaiting physical sample</strong>.
            </span>
          </p>
        )}
        <RectificationList
          highlightId={justMarked?.id}
          rows={rectification}
          canRecord={canCreate}
          canEdit={can(user, "sample.edit")}
          canDelete={can(user, "sample.delete")}
        />
      </section>
    </>
  );
}

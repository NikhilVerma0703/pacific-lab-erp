import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { maxUploadMb } from "@/lib/uploads";
import { getMasterOptions } from "@/modules/master-data/service";
import { LabSampleForm } from "@/modules/samples/components/LabSampleForm";
import { inwardDesignNameOptions } from "@/modules/samples/inward-link";
import { RecentEntries } from "@/modules/samples/components/RecentEntries";
import { suggestLabNumbers } from "@/modules/samples/numbering";
import { labFormPermissions } from "@/modules/samples/page-helpers";
import { getRecentSamples, RECENT_PAGE_SIZE } from "@/modules/samples/queries";
import { newLabInput } from "@/modules/samples/schema";
import { ensureRecordStores } from "@/modules/records/sync";

export const metadata = { title: "Sample Data Entry" };
export const dynamic = "force-dynamic";

export default async function SamplesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  // Records saved before the Lab Sample / Inward-Outward databases existed get their copy (once per server start).
  await ensureRecordStores();
  if (!can(user, "sample.view")) notFound();
  const canCreate = can(user, "sample.create");
  const { page } = await searchParams;

  const [options, designNames, numbers, recent] = await Promise.all([
    getMasterOptions(),
    inwardDesignNameOptions(),
    suggestLabNumbers(),
    getRecentSamples(Number(page) || 1),
  ]);

  return (
    <>
      <PageHeader
        title="Sample Data Entry"
        description="Laboratory samples — basic information, design type and bodies, material details, L, a, b readings, output and remarks."
      />
      {canCreate ? (
        <LabSampleForm
          mode="create"
          defaults={newLabInput({ ...numbers, today: plantToday() })}
          attachments={[]}
          options={options}
          designNameOptions={designNames}
          permissions={labFormPermissions(user)}
          maxUploadMb={maxUploadMb()}
        />
      ) : (
        <p className="card p-5 text-sm text-ink-2">Your role can view lab samples but not create them.</p>
      )}
      <RecentEntries {...recent} pageSize={RECENT_PAGE_SIZE} canEdit={can(user, "sample.edit")} canDelete={can(user, "sample.delete")} />
    </>
  );
}

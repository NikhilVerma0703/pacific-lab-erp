import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { SampleForm } from "@/modules/samples/components/SampleForm";
import { RecentEntries } from "@/modules/samples/components/RecentEntries";
import { suggestNumbers } from "@/modules/samples/numbering";
import { formPermissions, uploadLimitMb } from "@/modules/samples/page-helpers";
import { getRecentSamples } from "@/modules/samples/queries";
import { newSampleInput } from "@/modules/samples/schema";
import { todayInPlant } from "@/modules/samples/service";

export const metadata = { title: "Sample Data Entry" };
export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  const user = await requireUser();
  if (!can(user, "sample.view")) notFound();
  const canCreate = can(user, "sample.create");

  const [options, numbers, recent] = await Promise.all([getMasterOptions(), suggestNumbers(), getRecentSamples(10)]);

  return (
    <>
      <PageHeader
        title="Sample Data Entry"
        description="Record a new laboratory sample — its formulation, design, vein, L/a/b readings and output. Every field is optional."
      />
      {canCreate ? (
        <SampleForm
          mode="create"
          defaults={newSampleInput({ ...numbers, today: todayInPlant() })}
          attachments={[]}
          options={options}
          permissions={formPermissions(user)}
          maxUploadMb={uploadLimitMb()}
        />
      ) : (
        <p className="card p-5 text-sm text-ink-2">Your role can view samples but not create them.</p>
      )}
      <RecentEntries rows={recent} canEdit={can(user, "sample.edit")} canDelete={can(user, "sample.delete")} />
    </>
  );
}

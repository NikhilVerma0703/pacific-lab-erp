import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { SampleForm } from "@/modules/samples/components/SampleForm";
import { formPermissions, uploadLimitMb } from "@/modules/samples/page-helpers";
import { getSampleDetail, referencedValueIds, toFormInput } from "@/modules/samples/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Sample" };

export default async function EditSamplePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "sample.edit")) notFound();
  const s = await getSampleDetail((await params).id);
  if (!s) notFound();
  const options = await getMasterOptions(referencedValueIds(s));

  return (
    <>
      <PageHeader
        title={`Edit Sample S.No. ${s.serialNo}`}
        description="Change any value and save. The previous version is kept in the audit log."
        actions={
          <Link href="/samples" className="btn-secondary">
            <ArrowLeft className="size-4" /> Back to entry
          </Link>
        }
      />
      <SampleForm
        key={s.updatedAt}
        mode="edit"
        sampleId={s.id}
        status={s.status}
        defaults={toFormInput(s)}
        attachments={s.attachments}
        options={options}
        permissions={formPermissions(user)}
        maxUploadMb={uploadLimitMb()}
      />
    </>
  );
}

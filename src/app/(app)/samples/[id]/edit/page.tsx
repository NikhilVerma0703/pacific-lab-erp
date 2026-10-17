import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { maxUploadMb } from "@/lib/uploads";
import { getMasterOptions } from "@/modules/master-data/service";
import { LabSampleForm } from "@/modules/samples/components/LabSampleForm";
import { inwardDesignNameOptions } from "@/modules/samples/inward-link";
import { labFormPermissions } from "@/modules/samples/page-helpers";
import { getSampleDetail, sampleValueIds, toLabFormInput } from "@/modules/samples/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Lab Sample" };

export default async function EditSamplePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "sample.edit")) notFound();
  const s = await getSampleDetail((await params).id);
  if (!s) notFound();
  const [options, designNames] = await Promise.all([
    getMasterOptions(sampleValueIds(s)),
    inwardDesignNameOptions(s.designNameRef ? [s.designNameRef.id] : []),
  ]);

  return (
    <>
      <PageHeader
        title={`Edit Lab Sample S.No. ${s.serialNo}`}
        description="Change any value and save. The previous version is kept in the audit log."
        actions={
          <Link href="/samples#recent" className="btn-secondary">
            <ArrowLeft className="size-4" /> Back to Recent Entries
          </Link>
        }
      />
      <LabSampleForm
        key={s.updatedAt}
        mode="edit"
        numbers={{ serialNo: s.serialNo, slabNumber: s.slabNumber, first: false }}
        sampleId={s.id}
        defaults={toLabFormInput(s)}
        attachments={s.attachments}
        options={options}
        designNameOptions={designNames}
        permissions={labFormPermissions(user)}
        maxUploadMb={maxUploadMb()}
      />
    </>
  );
}

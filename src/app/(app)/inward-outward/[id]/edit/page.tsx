import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { maxUploadMb } from "@/lib/uploads";
import { InwardForm } from "@/modules/inward-outward/components/InwardForm";
import { inwardFormPermissions } from "@/modules/inward-outward/page-helpers";
import { getInwardDetail, inwardValueIds, toInwardFormInput } from "@/modules/inward-outward/queries";
import { getMasterOptions } from "@/modules/master-data/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Inward / Outward Entry" };

export default async function EditInwardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "inward.edit")) notFound();
  const e = await getInwardDetail((await params).id);
  if (!e) notFound();
  const options = await getMasterOptions(inwardValueIds(e));

  return (
    <>
      <PageHeader
        title={`Edit Inward / Outward S.No. ${e.serialNo}`}
        description="Change any value and save. The previous version is kept in the audit log."
        actions={
          <Link href="/inward-outward#register" className="btn-secondary">
            <ArrowLeft className="size-4" /> Back to register
          </Link>
        }
      />
      <InwardForm
        key={e.updatedAt}
        mode="edit"
        numbers={{ serialNo: e.serialNo, slabNumber: e.slabNumber, first: false }}
        entryId={e.id}
        defaults={toInwardFormInput(e)}
        attachments={e.attachments}
        options={options}
        permissions={inwardFormPermissions(user)}
        maxUploadMb={maxUploadMb()}
      />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { InwardForm } from "@/modules/inward-outward/components/InwardForm";
import { getInwardDetail, inwardReferencedIds, inwardToFormInput } from "@/modules/inward-outward/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Inward / Outward Entry" };

export default async function EditInwardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "inward.edit")) notFound();
  const e = await getInwardDetail((await params).id);
  if (!e) notFound();
  const options = await getMasterOptions(inwardReferencedIds(e));
  return (
    <>
      <PageHeader
        title={`Edit Inward / Outward — Serial No. ${e.serialNo}`}
        description="Change any value and save. The previous version is kept in the audit log."
        actions={
          <Link href="/inward-outward#recent" className="btn-secondary">
            <ArrowLeft className="size-4" /> Back
          </Link>
        }
      />
      <InwardForm
        key={e.updatedAt}
        mode="edit"
        entryId={e.id}
        defaults={inwardToFormInput(e)}
        linkedSample={e.labSample}
        options={options}
        canOverrideNumbers={can(user, "inward.overrideNumbers")}
        canAddMaster={can(user, "master.addFromForm")}
      />
    </>
  );
}

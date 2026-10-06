import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { ProductionForm } from "@/modules/production/components/ProductionForm";
import { productionFormPermissions } from "@/modules/production/page-helpers";
import { getProductionDetail, productionValueIds, toProductionFormInput } from "@/modules/production/queries";
import { uploadLimitMb } from "@/modules/samples/page-helpers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Production Sample" };

export default async function EditProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "production.edit")) notFound();
  const s = await getProductionDetail((await params).id);
  if (!s) notFound();
  const options = await getMasterOptions(productionValueIds(s));

  return (
    <>
      <PageHeader
        title={`Edit Production Sample S. No. ${s.serialNo}`}
        description="Change any value and save. The previous version is kept in the audit log."
        actions={
          <Link href="/production-sample#register" className="btn-secondary">
            <ArrowLeft className="size-4" /> Back to register
          </Link>
        }
      />
      <ProductionForm
        key={s.updatedAt}
        mode="edit"
        entryId={s.id}
        defaults={toProductionFormInput(s)}
        attachments={s.attachments}
        options={options}
        permissions={productionFormPermissions(user)}
        maxUploadMb={uploadLimitMb()}
      />
    </>
  );
}

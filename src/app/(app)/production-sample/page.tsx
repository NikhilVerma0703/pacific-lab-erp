import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { getMasterOptions } from "@/modules/master-data/service";
import { ProductionForm } from "@/modules/production/components/ProductionForm";
import { ProductionRegister } from "@/modules/production/components/ProductionRegister";
import { suggestProductionNumbers } from "@/modules/production/numbering";
import { productionFormPermissions } from "@/modules/production/page-helpers";
import { getProductionRegister, REGISTER_PAGE_SIZE } from "@/modules/production/queries";
import { newProductionInput } from "@/modules/production/schema";
import { uploadLimitMb } from "@/modules/samples/page-helpers";

export const metadata = { title: "Production Sample" };
export const dynamic = "force-dynamic";

export default async function ProductionSamplePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  if (!can(user, "production.view")) notFound();
  const canCreate = can(user, "production.create");
  const { page } = await searchParams;

  const [options, numbers, register] = await Promise.all([
    getMasterOptions(),
    suggestProductionNumbers(),
    getProductionRegister(Number(page) || 1),
  ]);

  return (
    <>
      <PageHeader title="Production Sample" description="Samples received from the production plant and their readings." />
      {canCreate ? (
        <ProductionForm
          mode="create"
          defaults={newProductionInput({ ...numbers, today: plantToday() })}
          attachments={[]}
          options={options}
          permissions={productionFormPermissions(user)}
          maxUploadMb={uploadLimitMb()}
        />
      ) : (
        <p className="card p-5 text-sm text-ink-2">Your role can view production samples but not create them.</p>
      )}
      <ProductionRegister
        {...register}
        pageSize={REGISTER_PAGE_SIZE}
        canEdit={can(user, "production.edit")}
        canDelete={can(user, "production.delete")}
      />
    </>
  );
}

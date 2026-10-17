import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { plantToday } from "@/lib/plant-time";
import { requireUser } from "@/lib/session";
import { maxUploadMb } from "@/lib/uploads";
import { InwardForm } from "@/modules/inward-outward/components/InwardForm";
import { InwardRegister } from "@/modules/inward-outward/components/InwardRegister";
import { suggestInwardNumbers } from "@/modules/inward-outward/numbering";
import { inwardFormPermissions } from "@/modules/inward-outward/page-helpers";
import { getInwardRegister, REGISTER_PAGE_SIZE } from "@/modules/inward-outward/queries";
import { newInwardInput } from "@/modules/inward-outward/schema";
import { getMasterOptions } from "@/modules/master-data/service";
import { ensureRecordStores } from "@/modules/records/sync";

export const metadata = { title: "Sample Inward / Outward" };
export const dynamic = "force-dynamic";

export default async function InwardOutwardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  // Records saved before the Lab Sample / Inward-Outward databases existed get their copy (once per server start).
  await ensureRecordStores();
  if (!can(user, "inward.view")) notFound();
  const canCreate = can(user, "inward.create");
  const { page } = await searchParams;

  const [options, numbers, register] = await Promise.all([
    getMasterOptions(),
    suggestInwardNumbers(),
    getInwardRegister(Number(page) || 1),
  ]);

  return (
    <>
      <PageHeader
        title="Sample Inward / Outward"
        description="Physical samples from companies — sample details, design type and bodies, L, a, b readings, output and remarks."
      />
      {canCreate ? (
        <InwardForm
          mode="create"
          numbers={numbers}
          defaults={newInwardInput({ ...numbers, today: plantToday() })}
          attachments={[]}
          options={options}
          permissions={inwardFormPermissions(user)}
          maxUploadMb={maxUploadMb()}
        />
      ) : (
        <p className="card p-5 text-sm text-ink-2">Your role can view inward / outward entries but not create them.</p>
      )}

      <InwardRegister {...register} pageSize={REGISTER_PAGE_SIZE} canEdit={can(user, "inward.edit")} canDelete={can(user, "inward.delete")} />
    </>
  );
}

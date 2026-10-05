import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { listCategories, listValues } from "@/modules/master-data/service";
import { MasterDataManager } from "@/modules/master-data/components/MasterDataManager";

export const metadata = { title: "Master Data" };

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const user = await requireUser();
  if (!can(user, "master.view")) notFound();
  const { list } = await searchParams;
  const categories = await listCategories();
  const selected = categories.find((c) => c.code === list) ?? categories[0];
  const data = selected ? await listValues(selected.code) : null;

  return (
    <>
      <PageHeader
        title="Master Data"
        description="The dropdown lists used across the Lab ERP. Values are never deleted — disable a value to hide it from new entries while old samples keep it."
      />
      {selected && data ? (
        <MasterDataManager
          categories={categories}
          selectedCode={selected.code}
          category={data.category}
          values={data.values}
          canManage={can(user, "master.manage")}
        />
      ) : (
        <div className="card p-6 text-ink-2">No master lists yet. Run <code>npm run db:seed</code>.</div>
      )}
    </>
  );
}

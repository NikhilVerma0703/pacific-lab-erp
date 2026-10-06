import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { ProductionDetailView } from "@/modules/production/components/ProductionDetailView";
import { getProductionDetail } from "@/modules/production/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await getProductionDetail((await params).id);
  return { title: s ? `Production S. No. ${s.serialNo}` : "Production Sample" };
}

export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "production.view")) notFound();
  const s = await getProductionDetail((await params).id);
  if (!s) notFound();

  return (
    <>
      <PageHeader
        title={`Production Sample S. No. ${s.serialNo}`}
        description={`${s.slabNumber ? `Slab ${s.slabNumber} · ` : ""}${formatDate(s.sampleDate)}${s.designName ? ` · ${s.designName}` : ""}`}
        actions={
          <>
            <Link href="/production-sample#register" className="btn-secondary">
              <ArrowLeft className="size-4" /> Back
            </Link>
            {can(user, "production.edit") && (
              <Link href={`/production-sample/${s.id}/edit`} className="btn-primary">
                <Pencil className="size-4" /> Edit
              </Link>
            )}
          </>
        }
      />
      <ProductionDetailView s={s} />
    </>
  );
}

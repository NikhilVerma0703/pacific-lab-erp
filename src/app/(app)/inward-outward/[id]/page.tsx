import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { InwardDetailView } from "@/modules/inward-outward/components/InwardDetailView";
import { getInwardDetail } from "@/modules/inward-outward/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const e = await getInwardDetail((await params).id);
  return { title: e ? `Inward / Outward S.No. ${e.serialNo}` : "Inward / Outward Entry" };
}

export default async function InwardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "inward.view")) notFound();
  const e = await getInwardDetail((await params).id);
  if (!e) notFound();
  return (
    <>
      <PageHeader
        title={`Inward / Outward S.No. ${e.serialNo}`}
        description={[e.slabNumber ? `Slab ${e.slabNumber}` : null, formatDate(e.entryDate), e.company?.label, e.sampleDesignName].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href="/inward-outward#register" className="btn-secondary">
              <ArrowLeft className="size-4" /> Back
            </Link>
            {can(user, "inward.edit") && (
              <Link href={`/inward-outward/${e.id}/edit`} className="btn-primary">
                <Pencil className="size-4" /> Edit
              </Link>
            )}
          </>
        }
      />
      <InwardDetailView e={e} />
    </>
  );
}

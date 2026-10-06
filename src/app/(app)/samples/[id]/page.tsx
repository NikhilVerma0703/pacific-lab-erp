import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { SampleDetailView } from "@/modules/samples/components/SampleDetailView";
import { getSampleDetail } from "@/modules/samples/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSampleDetail((await params).id);
  return { title: s ? `S.No. ${s.serialNo}` : "Sample" };
}

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "sample.view")) notFound();
  const s = await getSampleDetail((await params).id);
  if (!s) notFound();

  return (
    <>
      <PageHeader
        title={`Sample S.No. ${s.serialNo}`}
        description={`${s.slabNumber ? `Slab ${s.slabNumber} · ` : ""}${formatDate(s.sampleDate)}${s.designName ? ` · ${s.designName}` : ""}`}
        actions={
          <>
            <Link href="/samples" className="btn-secondary">
              <ArrowLeft className="size-4" /> Back
            </Link>
            {can(user, "sample.edit") && (
              <Link href={`/samples/${s.id}/edit`} className="btn-primary">
                <Pencil className="size-4" /> Edit
              </Link>
            )}
          </>
        }
      />
      <SampleDetailView s={s} />
    </>
  );
}

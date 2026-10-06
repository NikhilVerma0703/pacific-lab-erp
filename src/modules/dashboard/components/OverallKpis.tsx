import {
  AlertTriangle,
  Building2,
  Factory,
  FlaskConical,
  Layers,
  Lightbulb,
  Microscope,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { DashboardData } from "../queries";

export function OverallKpis({ data }: { data: DashboardData["overall"] }) {
  const cards: { label: string; value: number; icon: React.ReactNode; href?: string; note?: string }[] = [
    { label: "Total Samples", value: data.totalSamples, icon: <Layers className="size-4" />, href: "/samples" },
    { label: "Total Lab Samples", value: data.lab, icon: <FlaskConical className="size-4" />, href: "/samples" },
    { label: "Total Line Samples", value: data.line, icon: <Workflow className="size-4" />, note: "Not recorded yet" },
    { label: "Total Creative Samples", value: data.creative, icon: <Lightbulb className="size-4" />, href: "/reports?range=30" },
    { label: "Total Inspired Samples", value: data.inspired, icon: <Sparkles className="size-4" />, href: "/reports?range=30" },
    { label: "Total Designs Worked On", value: data.designs, icon: <Microscope className="size-4" />, href: "/reports?range=30" },
    { label: "Total Companies", value: data.companies, icon: <Building2 className="size-4" />, href: "/master-data?list=COMPANY" },
    { label: "Total Rectification Cases", value: data.rectification, icon: <AlertTriangle className="size-4" />, href: "/inward-outward#rectification" },
    { label: "Total Production Samples", value: data.production, icon: <Factory className="size-4" />, href: "/production-sample#register" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((c) => {
        const body = (
          <>
            <p className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">
              <span className="text-ink-3">{c.icon}</span>
              <span className="leading-tight">{c.label}</span>
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{c.value.toLocaleString("en-IN")}</p>
            {c.note && <p className="mt-0.5 text-[11px] text-ink-3">{c.note}</p>}
          </>
        );
        return c.href ? (
          <Link key={c.label} href={c.href} className="card block px-4 py-3 transition-colors hover:border-brand-2/50">
            {body}
          </Link>
        ) : (
          <div key={c.label} className="card px-4 py-3">
            {body}
          </div>
        );
      })}
    </div>
  );
}

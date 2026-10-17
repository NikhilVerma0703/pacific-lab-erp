import {
  FlaskConical,
  Layers,
  Microscope,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardData } from "../queries";

export function OverallKpis({ data }: { data: DashboardData["overall"] }) {
  // Four cards: two rows of two on phones, one row of four from tablets up.
  const cards: {
    label: string;
    value: number;
    icon: React.ReactNode;
    href?: string;
    note?: string;
    wide?: boolean;
  }[] = [
    {
      label: "Total Samples",
      value: data.totalSamples,
      icon: <Layers className="size-4" />,
      href: "/samples",
    },
    {
      label: "Total Lab Samples",
      value: data.lab,
      icon: <FlaskConical className="size-4" />,
      href: "/samples",
    },
    {
      label: "Total Line Samples",
      value: data.line,
      icon: <Workflow className="size-4" />,
      href: "/production-sample#register",
      note: "Production Samples",
    },
    {
      label: "Total Designs Worked On",
      value: data.designs,
      icon: <Microscope className="size-4" />,
      href: "/reports?range=30",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => {
        const body = (
          <>
            {/* Two-line room on wide screens, so the numbers of a row line up. */}
            <p className="flex items-start gap-2 text-[12px] leading-tight font-semibold tracking-wide text-ink-2 uppercase xl:min-h-[30px]">
              <span className="text-ink-3">{c.icon}</span>
              <span className="leading-tight">{c.label}</span>
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
              {c.value.toLocaleString("en-IN")}
            </p>
            {c.note && (
              <p className="mt-0.5 text-[11px] text-ink-3">{c.note}</p>
            )}
          </>
        );
        return c.href ? (
          <Link
            key={c.label}
            href={c.href}
            className={cn(
              "card block px-4 py-3 transition-colors hover:border-brand-2/50",
              c.wide && "col-span-2 xl:col-span-1",
            )}
          >
            {body}
          </Link>
        ) : (
          <div
            key={c.label}
            className={cn(
              "card px-4 py-3",
              c.wide && "col-span-2 xl:col-span-1",
            )}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}

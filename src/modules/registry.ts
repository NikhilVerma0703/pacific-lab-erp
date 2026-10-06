/**
 * Module registry — the Lab ERP's sections, in sidebar order.
 *
 * Each section declares its route, icon, the permission that reveals it and
 * whether it is live yet. The sidebar, the mobile menu and the page titles all
 * read from here, so adding a section later is one entry plus its folder under
 * src/app/(app) and src/modules — nothing else is hard-wired.
 */
import type { Permission } from "@/lib/permissions";

export type ModuleStatus = "live" | "planned";

export interface ModuleDef {
  key: string;
  label: string;
  href: string;
  /** lucide-react icon name, resolved in the shell. */
  icon: "LayoutDashboard" | "FlaskConical" | "ArrowLeftRight" | "Factory" | "BarChart3" | "Download" | "Database";
  description: string;
  permission: Permission;
  status: ModuleStatus;
}

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    description: "Today, overall totals and the Forum",
    permission: "dashboard.view",
    status: "live",
  },
  {
    key: "samples",
    label: "Sample Data Entry",
    href: "/samples",
    icon: "FlaskConical",
    description: "Create and maintain lab samples and their formulations",
    permission: "sample.view",
    status: "live",
  },
  {
    key: "inward-outward",
    label: "Sample Inward / Outward",
    href: "/inward-outward",
    icon: "ArrowLeftRight",
    description: "Physical samples received / sent, and Rectification",
    permission: "inward.view",
    status: "live",
  },
  {
    key: "production-sample",
    label: "Production Sample",
    href: "/production-sample",
    icon: "Factory",
    description: "Samples received from the production plant and their readings",
    permission: "production.view",
    status: "live",
  },
  {
    key: "reports",
    label: "Reports",
    href: "/reports",
    icon: "BarChart3",
    description: "Production, sample mix, design and material consumption",
    permission: "reports.view",
    status: "live",
  },
  {
    key: "downloads",
    label: "Downloads",
    href: "/downloads",
    icon: "Download",
    description: "Excel downloads by date, and filtered exports",
    permission: "downloads.view",
    status: "live",
  },
  {
    key: "master-data",
    label: "Master Data",
    href: "/master-data",
    icon: "Database",
    description: "Dropdown lists: resins, grits, fillers, pigments, designs …",
    permission: "master.view",
    status: "live",
  },
];

export function moduleForPath(pathname: string): ModuleDef | undefined {
  return MODULES.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
}

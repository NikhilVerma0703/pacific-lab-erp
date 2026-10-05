"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Database,
  Download,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import { MODULES, type ModuleDef } from "@/modules/registry";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Permission, type Role } from "@/lib/permissions";

const ICONS = {
  LayoutDashboard,
  FlaskConical,
  ArrowLeftRight,
  Factory,
  BarChart3,
  Download,
  Database,
} satisfies Record<ModuleDef["icon"], unknown>;

interface ShellProps {
  user: { name: string; email: string; role: Role };
  permissions: Permission[];
  children: React.ReactNode;
}

export function AppShell({ user, permissions, children }: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const modules = MODULES.filter((m) => permissions.includes(m.permission));

  const nav = (
    <nav aria-label="Sections" className="flex flex-col gap-1 p-3">
      {modules.map((m) => {
        const Icon = ICONS[m.icon];
        const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
        if (m.status === "planned") {
          return (
            <div
              key={m.key}
              aria-disabled="true"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] text-white/40"
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="flex-1 truncate">{m.label}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                Soon
              </span>
            </div>
          );
        }
        return (
          <Link
            key={m.key}
            href={m.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors",
              active ? "bg-white text-brand" : "text-white/85 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
        <FlaskConical className="size-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold text-white">Lab ERP</p>
        <p className="text-xs text-white/60">Pacific Surfaces</p>
      </div>
    </div>
  );

  const userBox = (
    <div className="border-t border-white/10 p-3">
      <div className="px-2">
        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
        <p className="truncate text-xs text-white/60">{ROLE_LABEL[user.role]} · sign-in off</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {userBox}
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-brand px-2 lg:hidden">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-6" />
        </button>
        <FlaskConical className="size-5 text-white" />
        <span className="font-bold text-white">Lab ERP</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand shadow-xl">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {userBox}
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

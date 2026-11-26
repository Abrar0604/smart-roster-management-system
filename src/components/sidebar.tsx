"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarCog,
  CalendarCheck2,
  Building2,
  Layers,
  Store,
  Workflow,
  UserCheck,
  Users,
  Network,
  Link2,
  CalendarOff,
  CalendarHeart,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/roster/generate", label: "Roster Generator", icon: CalendarCog },
      { href: "/roster/latest", label: "Interactive Editor", icon: CalendarCheck2 },
    ],
  },
  {
    label: "Stakeholder Views",
    items: [
      { href: "/views/company", label: "Company-Wide", icon: Building2 },
      { href: "/views/pod", label: "Pod-Wise", icon: Layers },
      { href: "/views/brand", label: "Brand-Wise", icon: Store },
      { href: "/views/process", label: "Process-Wise", icon: Workflow },
      { href: "/views/employee", label: "Employee-Wise", icon: UserCheck },
    ],
  },
  {
    label: "Master Configuration",
    items: [
      { href: "/manage/employees", label: "Employees", icon: Users },
      { href: "/manage/pods", label: "Operational Pods", icon: Network },
      { href: "/manage/brands", label: "Brands & Rules", icon: Store },
      { href: "/manage/processes", label: "Processes", icon: Workflow },
      { href: "/manage/assignments", label: "Assignments", icon: Link2 },
      { href: "/manage/time-offs", label: "Leaves & Comp-Offs", icon: CalendarOff },
      { href: "/manage/holidays", label: "Public Holidays", icon: CalendarHeart },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 select-none">
      <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          onClick={() => setMobileOpen(false)}
        >
          <div className="h-8 w-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-mono text-xs font-bold tracking-tight">
            SR
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">
              Smart Roster
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              CX Ops Console
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 mb-1 text-[11px] font-medium text-slate-400 tracking-wide">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href === "/roster/latest" &&
                    pathname.startsWith("/roster/") &&
                    pathname !== "/roster/generate");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      active
                        ? "bg-blue-600/90 text-white"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-85" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
        <div className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Live validation active on schedule overrides & leave updates.
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-slate-950 text-white px-4 py-3 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center font-mono text-xs font-bold">
            SR
          </div>
          <span className="text-sm font-semibold">Smart Roster</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded hover:bg-slate-800"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Rail */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-800 sticky top-0 h-screen">
        {navContent}
      </aside>
    </>
  );
}

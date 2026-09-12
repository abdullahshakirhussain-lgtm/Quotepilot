"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/follow-ups", label: "Follow-ups", icon: BellRing },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            Q
          </span>
          QuotePilot
        </div>
        <div className="truncate px-5 pb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
          {businessName}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action="/auth/signout" method="post" className="p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">
              Q
            </span>
            QuotePilot
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost px-2 py-1 text-sm">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

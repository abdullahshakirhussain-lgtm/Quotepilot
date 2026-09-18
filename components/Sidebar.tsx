"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/follow-ups", label: "Follow-ups", icon: BellRing, badge: true },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/leads", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  businessName,
  attentionCount,
}: {
  businessName: string;
  /** Pending follow-ups due today or overdue. */
  attentionCount: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-stone-950 text-stone-400 md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-1 pt-5">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            QuoteLoop
          </span>
        </div>
        <div className="truncate px-5 pb-5 text-xs text-stone-500">
          {businessName}
        </div>

        <div className="px-3 pb-4">
          <Link href="/quotes?new=1" className="btn-accent w-full">
            <Plus className="h-4 w-4" /> New quote
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/5 hover:text-stone-200"
                )}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-500" />
                )}
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badge && attentionCount > 0 && (
                  <span className="num ml-auto rounded bg-brand-600 px-1.5 py-px text-[11px] font-semibold text-white">
                    {attentionCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <form action="/auth/signout" method="post" className="border-t border-white/5 p-3">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-stone-200">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 bg-stone-950 text-stone-400 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-white">
            QuoteLoop
          </div>
          <div className="flex items-center gap-1">
            <Link href="/quotes?new=1" className="btn-accent tap px-2.5 py-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Quote
            </Link>
            <form action="/auth/signout" method="post">
              <button className="tap inline-flex items-center justify-center rounded-md p-1.5 hover:bg-white/10" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                isActive(item.href) ? "bg-white/10 text-white" : "hover:bg-white/5"
              )}
            >
              {item.label}
              {item.badge && attentionCount > 0 && (
                <span className="num rounded bg-brand-600 px-1 text-[11px] font-semibold text-white">
                  {attentionCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

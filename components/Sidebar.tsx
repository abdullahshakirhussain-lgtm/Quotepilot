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

const NAV: { href: string; label: string; short?: string; icon: typeof LayoutDashboard; badge?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
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
                aria-current={active ? "page" : undefined}
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

      {/* Phones: a slim top bar with the main action... */}
      <div className="sticky top-0 z-30 bg-stone-950 text-stone-400 md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="font-semibold text-white">QuoteLoop</div>
          <Link href="/quotes?new=1" className="btn-accent tap px-3 py-1.5">
            <Plus className="h-4 w-4" /> New quote
          </Link>
        </div>
      </div>

      {/* ...and every section in a tab bar along the bottom, always in view.
          Signing out lives in Settings, away from the buttons used all day. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-6">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.badge && attentionCount > 0 ? `${item.label}, ${attentionCount} need attention` : item.label}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[10.5px] font-medium",
                    active ? "text-brand-700" : "text-stone-500 hover:text-stone-900"
                  )}
                >
                  {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand-600" />}
                  <Icon className="h-5 w-5" />
                  <span className="max-w-full truncate leading-tight">{item.short ?? item.label}</span>
                  {item.badge && attentionCount > 0 && (
                    <span className="num absolute left-1/2 top-1.5 ml-2 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold leading-4 text-white">
                      {attentionCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

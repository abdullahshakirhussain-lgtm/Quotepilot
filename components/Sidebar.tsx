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

type Item = { href: string; label: string; short?: string; icon: typeof LayoutDashboard; badge?: boolean };

const HOME: Item = { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard };
const WORK: Item[] = [
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/follow-ups", label: "Follow-ups", icon: BellRing, badge: true },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/leads", label: "Customers", icon: Users },
];
const SETTINGS: Item = { href: "/settings", label: "Settings", icon: Settings };
const ALL = [HOME, ...WORK, SETTINGS];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("num rounded-full bg-red-500 px-1.5 text-[12px] font-medium leading-5 text-white", className)}>
      {count}
    </span>
  );
}

/**
 * The dark bar across the top of every signed-in page: the wordmark, the
 * business, the trial note and "New quote" (the one action every page needs).
 */
export function TopBar({ businessName, trialNote }: { businessName: string; trialNote?: string | null }) {
  return (
    <header className="sticky top-0 z-30 bg-stone-900 text-white">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-5">
        <Link href="/dashboard" className="tap inline-flex items-center text-[20px] font-bold leading-none" aria-label="QuoteLoop dashboard">
          QuoteLoop
        </Link>
        <span
          className="hidden max-w-[16rem] truncate rounded-[6px] border border-stone-500 px-2 py-0.5 text-[13px] text-stone-200 lg:inline"
          title={businessName}
        >
          {businessName}
        </span>
        <div className="ml-auto flex items-center gap-4">
          {trialNote && (
            <Link href="/settings#billing" className="hidden whitespace-nowrap text-[13px] text-stone-200 underline-offset-4 hover:text-white hover:underline md:inline">
              {trialNote}
            </Link>
          )}
          <Link href="/quotes?new=1" className="btn tap bg-white px-3.5 text-stone-900 hover:bg-stone-100">
            <Plus className="h-4 w-4" strokeWidth={2.4} /> New quote
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Laptops and up: the menu as a card down the left side. */
export function Sidebar({ attentionCount }: { attentionCount: number }) {
  const isActive = useActive();
  const link = (item: Item) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-[8px] px-3 text-[15px] transition-colors duration-150",
          active ? "bg-stone-900 font-medium text-white" : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
        {item.label}
        {item.badge && attentionCount > 0 && <Badge count={attentionCount} className="ml-auto" />}
      </Link>
    );
  };
  const heading = (text: string) => <div className="px-3 pb-1.5 pt-4 text-[12px] font-medium text-stone-400">{text}</div>;

  return (
    <aside className="sticky top-[76px] hidden w-[200px] shrink-0 self-start lg:block">
      <nav aria-label="Main" className="card flex flex-col p-2">
        {link(HOME)}
        {heading("Work")}
        {WORK.map(link)}
        {heading("Account")}
        {link(SETTINGS)}
        <form action="/auth/signout" method="post">
          <button className="flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-[15px] text-stone-700 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900">
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
            Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}

/** Phones and tablets: every section in a tab bar along the bottom, always in view.
    Signing out lives in Settings, away from the buttons used all day. */
export function TabBar({ attentionCount }: { attentionCount: number }) {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-6">
        {ALL.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.badge && attentionCount > 0 ? `${item.label}, ${attentionCount} need attention` : item.label}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium transition-colors duration-150",
                  active ? "text-stone-900" : "text-stone-500 hover:text-stone-900"
                )}
              >
                <span className={cn("grid h-7 w-11 place-items-center rounded-full", active && "bg-stone-900 text-white")}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className="max-w-full truncate leading-tight">{item.short ?? item.label}</span>
                {item.badge && attentionCount > 0 && <Badge count={attentionCount} className="absolute left-1/2 top-0.5 ml-2 text-[11px] leading-4" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

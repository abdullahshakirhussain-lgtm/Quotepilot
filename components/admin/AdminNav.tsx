"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/health", label: "Health" },
];

/** Plain links (a fresh page each): the admin is read on demand, never cached. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ITEMS.map((item) => {
        const on = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "tap inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors duration-150",
              on ? "border-stone-300 bg-stone-200/80 text-stone-900" : "border-line bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

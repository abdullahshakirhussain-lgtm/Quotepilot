import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

// Never in search results, and never listed in robots.txt (which is public).
export const metadata: Metadata = {
  title: "Admin | QuoteLoop",
  robots: { index: false, follow: false },
};

/** QuoteLoop's own admin: read-only, for the addresses in ADMIN_EMAILS only. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="tap inline-flex items-center text-[20px] font-bold leading-none text-stone-900">
            QuoteLoop
          </Link>
          <span className="text-[14px] text-stone-500">Admin, read-only</span>
          <span className="ml-auto hidden truncate text-[13px] text-stone-500 sm:block">{user.email}</span>
          <Link href="/dashboard" className="btn-secondary px-3">
            Back to the app
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-5 sm:px-6">
        <AdminNav />
        {children}
      </div>
    </div>
  );
}

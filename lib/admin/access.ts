// Who may open /admin: only the confirmed email addresses listed in the
// ADMIN_EMAILS setting (comma-separated). Everyone else, signed in or not, gets
// an ordinary "not found", so the page doesn't reveal that it exists.
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True only for a signed-in user whose confirmed email is on the list. */
export function isAdmin(user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && user?.email_confirmed_at && adminEmails().includes(email));
}

/** The signed-in admin, or a 404 for anyone else. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();
  return user!;
}

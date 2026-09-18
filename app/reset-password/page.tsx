import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password — QuoteLoop",
};

// Reached from a password reset email: /auth/callback signs the person in first.
export default async function ResetPasswordPage() {
  const user = await requireUser();
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <ResetPasswordForm email={user.email ?? null} />
    </main>
  );
}

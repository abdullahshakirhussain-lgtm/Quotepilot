import { AuthShell } from "@/components/auth/AuthShell";
import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password | QuoteLoop",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Set by /auth/callback when a reset link didn't work.
  const { error } = await searchParams;
  return (
    <AuthShell>
      <ForgotPasswordForm linkFailed={error === "link"} />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — QuoteLoop",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Set by /auth/callback when a reset link didn't work.
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <ForgotPasswordForm linkFailed={error === "link"} />
    </main>
  );
}

import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — QuoteLoop",
};

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <ForgotPasswordForm />
    </main>
  );
}

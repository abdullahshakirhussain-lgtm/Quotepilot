"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { cleanPasted, isValidEmail } from "@/lib/email-address";

/**
 * Asks Supabase Auth to email a password reset link. The link signs the person
 * in through /auth/callback and lands on /reset-password to choose a new one.
 * The answer is the same whether or not an account exists for the address.
 */
export default function ForgotPasswordForm({ linkFailed = false }: { linkFailed?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    linkFailed
      ? "That reset link didn't work. It may have expired, already been used, or been opened in a different browser from the one you asked for it in. Enter your email to get a new one."
      : null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const address = cleanPasted(email);
    if (!isValidEmail(address)) {
      setError("That email address doesn't look right. Check it and try again.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (error) throw error;
      setSentTo(address);
    } catch (err) {
      setError(authErrorMessage(err, "reset-request"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="tap mb-8 flex items-center justify-center gap-2.5 text-[15px] font-semibold tracking-tight">
        QuoteLoop
      </Link>

      <div className="card p-7">
        {sentTo ? (
          <>
            <h1 className="text-lg font-semibold text-stone-900">Check your email</h1>
            <p className="mt-2 text-sm text-stone-600">
              If there&apos;s a QuoteLoop account for <strong className="break-all">{sentTo}</strong>, we&apos;ve
              emailed it a link to choose a new password.
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Open the link in this browser. It only works once. Nothing arrived after a few minutes? Check your
              spam folder, then try again.
            </p>
            <button type="button" className="btn-secondary mt-6 w-full" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">Reset your password</h1>
            <p className="mt-1 text-sm text-stone-500">
              Enter the email you log in with and we&apos;ll send you a link to choose a new password.
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200"
                >
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Email me a reset link
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-stone-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-stone-900 underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

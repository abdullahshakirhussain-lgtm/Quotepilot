"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

/** Sets a new password for the signed-in account (reached from a reset link). */
export default function ResetPasswordForm({ email }: { email: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError("Use at least 6 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match. Type the same password in both boxes.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err, "new-password"));
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
        {done ? (
          <>
            <h1 className="text-lg font-semibold text-stone-900">Password changed</h1>
            <p className="mt-2 text-sm text-stone-600">
              Your new password is saved and you&apos;re logged in. Use it next time you log in with your email.
            </p>
            <Link href="/dashboard" className="btn-primary mt-6 w-full">
              Go to your dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">Choose a new password</h1>
            <p className="mt-1 text-sm text-stone-500">
              {email ? (
                <>
                  For <span className="break-all font-medium text-stone-700">{email}</span>.
                </>
              ) : (
                "For the account you're logged in to."
              )}
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              {/* Lets password managers save the new password against the right account. */}
              <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
              <div>
                <label htmlFor="new-password" className="label">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="label">
                  Type it again
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                Save new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

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
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
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
    <div className="w-full">
      <div className="ql-in">
        {done ? (
          <>
            <h1 className="page-title">Password changed</h1>
            <p className="mt-3 text-base text-stone-800">
              Your new password is saved and you&apos;re logged in. Use it next time you log in with your email.
            </p>
            <Link href="/dashboard" className="btn-primary mt-6 w-full">
              Go to your dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="page-title">Choose a new password</h1>
            <p className="mt-3 text-base text-stone-700">
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
                  placeholder="At least 8 characters"
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
                  className="msg-error"
                >
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
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

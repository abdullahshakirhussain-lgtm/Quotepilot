"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Only allow same-site paths as a post-login destination. Anything else
 * (absolute URLs, protocol-relative `//host`, `/\host`) would be an open
 * redirect that attackers can use in phishing links.
 */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard";
  }
  return value;
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there is no session yet.
        if (!data.session) {
          setCheckEmail(true);
          setLoading(false);
          return;
        }
        router.push("/onboarding");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account, then log in.
        </p>
        <Link href="/login" className="btn-primary mt-6 w-full">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="card w-full max-w-md p-8">
      <div className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
          Q
        </span>
        QuotePilot
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isSignup
          ? "Start tracking quotes and follow-ups in minutes."
          : "Log in to your QuotePilot workspace."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to QuotePilot?{" "}
            <Link href="/signup" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

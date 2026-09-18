"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { Loader2 } from "lucide-react";
import { safeRedirectPath } from "@/lib/utils";
import { authErrorMessage } from "@/lib/auth-errors";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.83z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}

/**
 * Whether Google is switched on in Supabase. signInWithOAuth can't tell — it
 * just navigates, and a disabled provider lands on Supabase's raw JSON error —
 * but the public auth settings endpoint can. "unknown" if it can't be checked.
 */
async function googleProviderStatus(): Promise<"enabled" | "disabled" | "unknown"> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "unknown";
    const google = (await res.json())?.external?.google;
    return google === true ? "enabled" : google === false ? "disabled" : "unknown";
  } catch {
    return "unknown";
  }
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirectPath(params.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    // Set by /auth/callback: Google was cancelled, or a confirmation link failed.
    // (A reset link that fails goes to /forgot-password instead.)
    params.get("error") === "oauth"
      ? "Sign-in didn't complete. Please try again. If you were confirming your email, log in with your password."
      : null
  );
  const [checkEmail, setCheckEmail] = useState(false);

  // Pressing Back on Google's page can restore this page exactly as it was
  // left (spinner on, buttons disabled), so reset it when that happens.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogleLoading(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const isSignup = mode === "signup";
  // Where the one-time code from Google / the confirmation email comes back to.
  const callbackUrl = (next: string) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function continueWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      if ((await googleProviderStatus()) === "disabled") {
        setError("Google sign-in isn't set up yet. Please use your email and password.");
        setGoogleLoading(false);
        return;
      }
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        // New users are routed to onboarding by the app layout.
        options: { redirectTo: callbackUrl(isSignup ? "/dashboard" : redirectTo) },
      });
      if (error) throw error;
      // The browser is now on its way to Google.
    } catch {
      setError("Couldn't start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  }

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // If email confirmation is on, the link signs the user straight in.
          options: { emailRedirectTo: callbackUrl("/dashboard") },
        });
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(authErrorMessage(err, isSignup ? "signup" : "login"));
      setLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="tap mb-8 flex items-center justify-center gap-2.5 text-[15px] font-semibold tracking-tight">
        QuoteLoop
      </Link>

      {checkEmail ? (
        <div className="card p-7 text-center">
          <h1 className="text-lg font-semibold text-stone-900">Check your email</h1>
          <p className="mt-2 text-sm text-stone-600">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account. Open it in this browser to be signed in straight away.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            No email after a few minutes? Check your spam folder. If you already have an account with
            this address, log in instead, or use{" "}
            <Link href="/forgot-password" className="font-medium text-stone-800 underline-offset-2 hover:underline">
              Forgot password
            </Link>
            .
          </p>
          <Link href="/login" className="btn-secondary mt-6 w-full">
            Back to log in
          </Link>
        </div>
      ) : (
        <div className="card p-7">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            {isSignup ? "Start following up" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {isSignup
              ? "Create your account. Setup takes about a minute."
              : "Log in to see who needs a follow-up today."}
          </p>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={busy}
            className="btn-secondary mt-6 w-full py-2"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            or with email
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="password" className="label">
                  Password
                </label>
                {!isSignup && (
                  <Link
                    href="/forgot-password"
                    className="tap -my-2 inline-flex items-center text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
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
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2" disabled={busy}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Log in"}
            </button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-stone-900 underline-offset-2 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to QuoteLoop?{" "}
            <Link href="/signup" className="font-medium text-stone-900 underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
 * but the public auth settings endpoint can. "unreachable" when the sign-in
 * service doesn't answer (down, paused, offline): Google's redirect would land
 * on a browser error page, so it isn't started. "unknown" if it can't tell.
 */
async function googleProviderStatus(): Promise<"enabled" | "disabled" | "unreachable" | "unknown"> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 500) return "unreachable";
    if (!res.ok) return "unknown";
    const google = (await res.json())?.external?.google;
    return google === true ? "enabled" : google === false ? "disabled" : "unknown";
  } catch {
    // A network failure or timeout: the same service hosts the Google redirect.
    return "unreachable";
  }
}

/**
 * `redirect` and `error` come from the page's URL. The page reads them on the
 * server and passes them in, so the whole form is in the first HTML response
 * (no empty page while JavaScript loads).
 */
export default function AuthForm({
  mode,
  redirect = null,
  error: initialError = null,
}: {
  mode: "login" | "signup";
  redirect?: string | null;
  error?: string | null;
}) {
  const router = useRouter();
  const redirectTo = safeRedirectPath(redirect);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    // Set by /auth/callback: Google was cancelled, or a confirmation link failed.
    // (A reset link that fails goes to /forgot-password instead.)
    initialError === "oauth"
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
      const google = await googleProviderStatus();
      if (google === "disabled") {
        setError("Google sign-in isn't set up yet. Please use your email and password.");
        setGoogleLoading(false);
        return;
      }
      if (google === "unreachable") {
        setError("QuoteLoop couldn't reach the sign-in service. Check your connection and try again in a minute.");
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

    // New passwords need 8 characters; logging in still accepts older,
    // shorter ones so nobody is locked out of an existing account.
    if (password.length < (isSignup ? 8 : 6)) {
      setError(isSignup ? "Use at least 8 characters for your password." : "Password must be at least 6 characters.");
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
    <div className="w-full">
      {checkEmail ? (
        <div className="ql-in">
          <h1 className="page-title">Check your email</h1>
          <p className="mt-3 text-base text-stone-800">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account. Open it in this browser to be signed in straight away.
          </p>
          <p className="mt-2 text-base text-stone-700">
            No email after a few minutes? Check your spam folder. If you already have an account with
            this address, log in instead, or use{" "}
            <Link href="/forgot-password" className="font-medium text-info-700 hover:underline">
              Forgot password
            </Link>
            .
          </p>
          <Link href="/login" className="btn-secondary mt-6 w-full">
            Back to log in
          </Link>
        </div>
      ) : (
        <div className="ql-in">
          <h1 className="page-title">
            {isSignup ? "Start following up" : "Welcome back"}
          </h1>
          <p className="mt-3 text-base text-stone-700">
            {isSignup
              ? "Create your account. Setup takes about a minute."
              : "Log in to see who needs a follow-up today."}
          </p>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={busy}
            className="btn-secondary mt-8 w-full py-3 text-base"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[15px] text-stone-600">
            <span className="h-px flex-1 bg-stone-300" />
            or with email
            <span className="h-px flex-1 bg-stone-300" />
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
                    className="tap -my-2 inline-flex items-center text-[15px] font-medium text-stone-700 underline decoration-stone-300 decoration-2 underline-offset-4 hover:text-stone-900 hover:decoration-stone-900"
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
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
              />
            </div>

            {error && (
              <div className="msg-error">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={busy}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Log in"}
            </button>
          </form>
        </div>
      )}

      <p className="mt-8 border-t border-stone-200 pt-4 text-base text-stone-700">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-info-700 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to QuoteLoop?{" "}
            <Link href="/signup" className="font-medium text-info-700 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

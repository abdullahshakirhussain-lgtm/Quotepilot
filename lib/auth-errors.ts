// Supabase Auth reports problems in developer terms ("Invalid login
// credentials", "over_email_send_rate_limit", "Failed to fetch"). These are the
// same problems in words a business owner can act on.

type AuthContext = "login" | "signup" | "reset-request" | "new-password";

export function authErrorMessage(err: unknown, context: AuthContext): string {
  const e = (err ?? {}) as { code?: string; status?: number; message?: string; name?: string };
  const code = String(e.code ?? "");
  const message = String(e.message ?? "");

  if (e.name === "AuthRetryableFetchError" || err instanceof TypeError || /failed to fetch|network/i.test(message)) {
    return "QuoteLoop couldn't reach the sign-in service. Check your connection and try again.";
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "That email and password don't match. Check them and try again. If you signed up with Google, use Continue with Google, or reset your password.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Confirm your email address first: open the link we emailed you when you signed up.";
  }
  if (code === "user_already_exists" || /already registered|already exists/i.test(message)) {
    return "An account with this email already exists. Log in instead, or reset your password.";
  }
  if (code.startsWith("over_") || e.status === 429 || /rate limit|security purposes/i.test(message)) {
    return context === "reset-request" || context === "signup"
      ? "Too many emails were requested just now. Wait a minute or two, then try again."
      : "Too many attempts just now. Wait a minute, then try again.";
  }
  if (code === "weak_password" || /password should be|password is too weak/i.test(message)) {
    return "Choose a stronger password: at least 6 characters, and not one that's easy to guess.";
  }
  if (code === "same_password" || /different from the old password/i.test(message)) {
    return "Choose a password you haven't used for this account before.";
  }
  if (code === "email_address_invalid" || /invalid format|unable to validate email/i.test(message)) {
    return "That email address doesn't look right. Check it and try again.";
  }
  if (code === "signup_disabled" || /signups not allowed/i.test(message)) {
    return "New sign-ups are closed right now.";
  }
  if (code === "session_not_found" || code === "session_expired" || /auth session missing/i.test(message)) {
    return "Your reset link has expired or was already used. Request a new one.";
  }
  if (code === "reauthentication_needed") {
    return "For your security, log in again before changing your password.";
  }
  return context === "new-password"
    ? "Your password couldn't be changed just now. Please try again."
    : "Something went wrong signing you in. Please try again.";
}

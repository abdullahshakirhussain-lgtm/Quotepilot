import { CONTACT_EMAIL } from "@/lib/marketing";

/** Shown while no payment provider is connected. */
export const PAYMENTS_NOT_SET_UP = `Online payment isn't set up yet. Email ${CONTACT_EMAIL} and we'll get your account activated.`;

/** Where the provider sends people back to. Never built from the request: behind the host's proxy that is an internal address. */
export function billingReturnUrl(): string {
  const base = (process.env.APP_URL || "https://quoteloop.site").replace(/\/+$/, "");
  return `${base}/settings?billing=done#billing`;
}

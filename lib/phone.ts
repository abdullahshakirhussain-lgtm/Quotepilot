/**
 * Whether text reads as a phone number, however it's written: "+44 20 7946
 * 0958", "(555) 010-0173", "0775 062 242", "+1 555 0100 ext 12". Letters
 * ("call me maybe") or a stray digit or two are refused. Empty counts as fine:
 * a phone number is always optional.
 */
export function isPlausiblePhone(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s) return true;
  // An extension at the end: "ext 12", "ext. 12", "x12", "#12".
  const main = s.replace(/\s*(?:ext\.?|x|#)\s*\d{1,6}$/i, "");
  if (!/^\+?[\d\s().\-/]+$/.test(main)) return false;
  const digits = main.replace(/\D/g, "").length;
  return digits >= 5 && digits <= 17;
}

export const PHONE_ERROR =
  "That phone number doesn't look right. Use digits, spaces, + and dashes, or leave it empty.";

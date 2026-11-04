// What a customer wrote in a reply: no Node APIs here, so the browser can use it too.

/** Longest reply text kept in QuoteLoop (the forwarded email always has all of it). */
export const MAX_STORED_REPLY = 10_000;

/**
 * Only what the customer wrote this time: the quoted earlier emails that mail
 * apps add underneath ("On Mon, Ana wrote:", "-----Original Message-----",
 * "> ..." lines, an Outlook "From:" block) are cut off.
 */
export function newPartOfReply(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) break;
    if (/^_{8,}$/.test(t)) break;
    // "On Tue, 3 Nov 2026 at 10:02, Ana <a@b.com> wrote:" (may wrap onto two lines)
    if (/^On\b.*\bwrote:?$/i.test(t) || (/^On\b/i.test(t) && /\bwrote:?$/i.test(lines[i + 1]?.trim() ?? ""))) break;
    if (/^From:\s.+/i.test(t) && lines.slice(i + 1, i + 4).some((l) => /^(Sent|Date|To|Subject):\s/i.test(l.trim()))) break;
    if (t.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The first couple of lines of a reply, for lists and updates. */
export function replySnippet(text: string | null | undefined, max = 160): string {
  const one = newPartOfReply(text ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

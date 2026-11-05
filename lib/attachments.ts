// ---------------------------------------------------------------------------
// Files sent with an email: PDFs and photos only, checked by their content
// (never by the name or type the browser claims), a few at a time, small
// enough for every inbox. Nothing is stored: the files go straight to the
// email, and the email itself lists them, so the sent text in the log says
// what was attached.
// ---------------------------------------------------------------------------

export const ATTACH_LIMITS = {
  maxFiles: 5,
  /** All files together, before encoding (Resend's cap is 40MB after base64). */
  maxTotalBytes: 10 * 1024 * 1024,
  maxNameLength: 120,
} as const;

/** What the file picker offers. The server checks the content again. */
export const ATTACH_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

/** A file as the browser sends it to the server action. */
export interface AttachmentInput {
  name: string;
  /** Base64 of the file's bytes (no data: prefix). */
  data: string;
}

/** A checked file, ready for the email. */
export interface OutgoingAttachment {
  filename: string;
  content: string;
  content_type: string;
}

const KINDS: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "application/pdf", ext: "pdf", test: (b) => ascii(b, 0, 5) === "%PDF-" },
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && ascii(b, 1, 3) === "PNG" },
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", ext: "gif", test: (b) => ascii(b, 0, 4) === "GIF8" },
  { type: "image/webp", ext: "webp", test: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP" },
  {
    type: "image/heic",
    ext: "heic",
    test: (b) => ascii(b, 4, 4) === "ftyp" && ["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(ascii(b, 8, 4)),
  },
];

function ascii(b: Uint8Array, start: number, length: number): string {
  let s = "";
  for (let i = start; i < start + length && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** The file's real kind from its first bytes, or null when it isn't a PDF or a photo. */
export function sniffKind(bytes: Uint8Array): { type: string; ext: string } | null {
  const k = KINDS.find((x) => x.test(bytes));
  return k ? { type: k.type, ext: k.ext } : null;
}

/** "1.4 MB", "820 KB". */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A name safe for an email header and any inbox: no folders, quotes, control
 * or invisible characters, a sensible length, and the extension of what the
 * file really is.
 */
export function safeFilename(raw: string, ext: string): string {
  const base = String(raw ?? "")
    .split(/[\\/]/)
    .pop()!
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿"<>:|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/^\.+/, "")
    .slice(0, ATTACH_LIMITS.maxNameLength - ext.length - 1)
    .trim();
  return `${base || "attachment"}.${ext}`;
}

const MAX_B64 = Math.ceil((ATTACH_LIMITS.maxTotalBytes * 4) / 3) + 16;

/**
 * Checks what the browser sent. Refuses with a message naming the file that
 * can't go, before anything is logged or sent.
 */
export function parseAttachments(input: unknown): { ok: true; files: OutgoingAttachment[] } | { ok: false; error: string } {
  if (input == null) return { ok: true, files: [] };
  if (!Array.isArray(input)) return { ok: false, error: "The attached files couldn't be read. Remove them and attach them again." };
  if (input.length === 0) return { ok: true, files: [] };
  if (input.length > ATTACH_LIMITS.maxFiles) {
    return { ok: false, error: `You can attach up to ${ATTACH_LIMITS.maxFiles} files to one email. Remove some, then send again.` };
  }
  const files: OutgoingAttachment[] = [];
  const used = new Set<string>();
  let total = 0;
  for (const item of input as AttachmentInput[]) {
    const shownName = typeof item?.name === "string" && item.name.trim() ? item.name.trim().slice(0, 200) : "A file";
    const data = typeof item?.data === "string" ? item.data : "";
    if (!data || data.length > MAX_B64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { ok: false, error: `${shownName} couldn't be read. Remove it and attach it again.` };
    }
    const bytes = Buffer.from(data, "base64");
    total += bytes.length;
    if (total > ATTACH_LIMITS.maxTotalBytes) {
      return {
        ok: false,
        error: `The attached files add up to more than ${fileSize(ATTACH_LIMITS.maxTotalBytes)}. Remove one, or attach smaller photos.`,
      };
    }
    const kind = sniffKind(bytes.subarray(0, 16));
    if (!kind) {
      return { ok: false, error: `${shownName} isn't a PDF or a photo (JPEG, PNG, WebP, GIF or HEIC), so it can't be attached.` };
    }
    // Two files with one name would be confusing in the customer's inbox.
    let filename = safeFilename(shownName, kind.ext);
    for (let n = 2; used.has(filename.toLowerCase()); n++) {
      filename = safeFilename(`${shownName.replace(/\.[A-Za-z0-9]{1,5}$/, "")} (${n})`, kind.ext);
    }
    used.add(filename.toLowerCase());
    files.push({ filename, content: bytes.toString("base64"), content_type: kind.type });
  }
  return { ok: true, files };
}

/** The line the email carries, so the customer (and the log) can see what was attached. */
export function attachedLine(filenames: string[]): string {
  return filenames.length ? `Attached: ${filenames.join(", ")}` : "";
}

"use client";

import { useId, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { ATTACH_ACCEPT, ATTACH_LIMITS, fileSize, type AttachmentInput } from "@/lib/attachments";

/** A file picked for an email, read and ready to send. */
export interface PickedFile extends AttachmentInput {
  size: number;
}

const ALLOWED = /\.(pdf|jpe?g|png|webp|gif|heic|heif)$/i;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** What the send action takes: names and contents only. */
export function toAttachmentInputs(files: PickedFile[]): AttachmentInput[] {
  return files.map(({ name, data }) => ({ name, data }));
}

/**
 * "Attach PDF or photo": up to five files, 10MB in all, shown as a list with a
 * Remove button each. The server checks every file again before sending.
 */
export function AttachFiles({
  files,
  onChange,
  disabled,
}: {
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const total = files.reduce((n, f) => n + f.size, 0);
  const full = files.length >= ATTACH_LIMITS.maxFiles;

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const picked = [...list];
    const room = ATTACH_LIMITS.maxFiles - files.length;
    if (picked.length > room) {
      setError(`You can attach up to ${ATTACH_LIMITS.maxFiles} files. ${room === 0 ? "Remove one first." : `Pick ${room} more at most.`}`);
      return;
    }
    const wrong = picked.find((f) => !ALLOWED.test(f.name));
    if (wrong) {
      setError(`${wrong.name} isn't a PDF or a photo, so it can't be attached.`);
      return;
    }
    const size = picked.reduce((n, f) => n + f.size, total);
    if (size > ATTACH_LIMITS.maxTotalBytes) {
      setError(`Files can add up to ${fileSize(ATTACH_LIMITS.maxTotalBytes)} in one email. Attach smaller photos, or fewer files.`);
      return;
    }
    setReading(true);
    try {
      const read = await Promise.all(picked.map(async (f) => ({ name: f.name, size: f.size, data: await readAsBase64(f) })));
      onChange([...files, ...read]);
    } catch {
      setError("A file couldn't be read. Try attaching it again.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="btn-secondary px-3"
          onClick={() => input.current?.click()}
          disabled={disabled || full || reading}
          aria-describedby={hintId}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
          {reading ? "Attaching…" : "Attach PDF or photo"}
        </button>
        <span id={hintId} className="text-[13px] text-stone-500">
          {files.length ? `${fileSize(total)} of ${fileSize(ATTACH_LIMITS.maxTotalBytes)}` : `Up to ${ATTACH_LIMITS.maxFiles} files, ${fileSize(ATTACH_LIMITS.maxTotalBytes)} in all`}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ATTACH_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-[13px] text-red-700" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5" aria-label="Attached files">
          {files.map((f, i) => (
            <li key={`${i}-${f.name}`} className="flex items-center gap-2 rounded-md border border-line bg-white pl-3 text-[14px]">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-stone-800">{f.name}</span>
              <span className="num shrink-0 text-[13px] text-stone-500">{fileSize(f.size)}</span>
              <button
                type="button"
                className="tap inline-flex shrink-0 items-center justify-center px-2.5 text-stone-500 hover:text-stone-900"
                onClick={() => {
                  setError(null);
                  onChange(files.filter((_, j) => j !== i));
                }}
                disabled={disabled}
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

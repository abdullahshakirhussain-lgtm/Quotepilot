"use client";

import { useState } from "react";
import { Bell, CreditCard, Mail, MessageSquareReply } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { openQuote } from "@/components/quotes/QuotePanel";
import type { AppNotification } from "@/lib/notifications";
import { formatDate } from "@/lib/utils";

/** Marks updates read; a plain request (server actions can stall on the dashboard). */
export async function markUpdatesRead(id?: string) {
  await fetch("/api/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(id ? { op: "read", id } : { op: "read_all" }),
  }).catch(() => {});
}

/** Where an update leads: its quote, or billing in Settings. */
export function openUpdate(n: Pick<AppNotification, "quote_id" | "kind">) {
  if (n.quote_id) openQuote(n.quote_id);
  else if (n.kind.startsWith("payment") || n.kind.startsWith("subscription")) window.location.assign("/settings?area=billing");
}

function Icon({ kind }: { kind: AppNotification["kind"] }) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "customer_reply" || kind === "auto_reply") return <MessageSquareReply className={cls} aria-hidden />;
  if (kind === "forward_failed") return <Mail className={cls} aria-hidden />;
  return <CreditCard className={cls} aria-hidden />;
}

/**
 * The bell in the top bar: how many updates are unread, and the list of what
 * happened in the background (replies, payments). Opening it marks them read.
 */
export function UpdatesBell({ unread: initialUnread }: { unread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);

  async function show() {
    setOpen(true);
    setError(false);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setItems(data.notifications ?? []);
      if (unread > 0) {
        await markUpdatesRead();
        setUnread(0);
      }
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="tap relative inline-flex items-center justify-center rounded-full px-2 text-stone-600 hover:text-stone-900"
        aria-label={unread ? `Updates, ${unread} new` : "Updates"}
        title="Updates"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="num absolute -right-0.5 top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} size="panel" title="Updates" description="What happened while you were busy.">
          {error && <div className="msg-error">Your updates couldn&apos;t be loaded just now. Try again in a moment.</div>}
          {!items && !error && <div className="card h-24 animate-pulse" aria-label="Loading updates" />}
          {items && items.length === 0 && (
            <div className="card p-5 text-[15px] text-stone-600">
              Nothing yet. When a customer replies, or something changes with your billing, it shows here.
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="card divide-y divide-line">
              {items.map((n) => {
                const clickable = Boolean(n.quote_id) || n.kind.startsWith("payment") || n.kind.startsWith("subscription");
                const inner = (
                  <>
                    <span className={`mt-0.5 ${n.read_at ? "text-stone-400" : "text-info-700"}`}>
                      <Icon kind={n.kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[15px] font-medium text-stone-900 [overflow-wrap:anywhere]">{n.title}</span>
                        <span className="num text-[12px] text-stone-500">{formatDate(n.created_at)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 block text-[14px] text-stone-600 [overflow-wrap:anywhere]">{n.body}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {clickable ? (
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-stone-50"
                        onClick={() => {
                          setOpen(false);
                          openUpdate(n);
                        }}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}

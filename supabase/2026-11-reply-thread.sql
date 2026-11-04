-- ===========================================================================
-- Reply threads and updates. Safe to re-run.
--
-- customer_replies now keeps the reply's text (up to 10,000 characters), its
-- email Message-ID (so an answer sent from QuoteLoop threads in the
-- customer's inbox) and the names of its attachments. Deleted with the quote's
-- account data like every other reply record.
--
-- notifications: what happened in the background (a customer replied, a
-- payment failed...), shown under the bell until read. Written only by the
-- server; a user can read their own, mark them read, and delete them.
-- ===========================================================================
alter table public.customer_replies add column if not exists body text
  check (body is null or char_length(body) <= 10000);
alter table public.customer_replies add column if not exists message_id text
  check (message_id is null or char_length(message_id) <= 500);
alter table public.customer_replies add column if not exists attachment_names text[];

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'customer_reply', 'auto_reply', 'forward_failed',
    'payment_received', 'payment_failed', 'payment_reversed',
    'subscription_canceled', 'subscription_expired'
  )),
  quote_id uuid references public.quotes (id) on delete set null,
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 400),
  -- One update per background event, however often it is retried.
  dedupe_key text unique check (dedupe_key is null or char_length(dedupe_key) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from authenticated, anon;
grant select, delete on table public.notifications to authenticated;
-- Marking read is the only change a user can make.
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

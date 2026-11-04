-- ===========================================================================
-- Customer replies. Safe to re-run.
--
-- Emails sent from QuoteLoop carry a reply address unique to the quote
-- (r-<token>@<reply domain>). When the customer replies, Resend passes the
-- email to /api/email/inbound, which records who replied and when, pauses the
-- quote's remaining reminders, and forwards the reply to the business email.
-- The message text itself is not stored.
--
-- reply_tokens: written by the user's own session when an email is sent; read
-- by the server's webhook. customer_replies: written only by the webhook
-- (service role); users can read and delete their own.
-- ===========================================================================
alter table public.quotes add column if not exists customer_replied_at timestamptz;
alter table public.follow_ups add column if not exists paused_by_reply boolean not null default false;

create table if not exists public.reply_tokens (
  token text primary key check (token ~ '^[a-z0-9]{24}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Kept when the quote is deleted, so a late reply still reaches the business.
  quote_id uuid references public.quotes (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_reply_tokens_quote on public.reply_tokens (quote_id) where quote_id is not null;
create index if not exists idx_reply_tokens_user on public.reply_tokens (user_id);

alter table public.reply_tokens enable row level security;
revoke all on table public.reply_tokens from authenticated, anon;
grant select, insert, delete on table public.reply_tokens to authenticated;

drop policy if exists "reply_tokens_select" on public.reply_tokens;
create policy "reply_tokens_select" on public.reply_tokens
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only for one of the caller's own quotes.
drop policy if exists "reply_tokens_insert" on public.reply_tokens;
create policy "reply_tokens_insert" on public.reply_tokens
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and quote_id is not null
    and exists (select 1 from public.quotes q where q.id = reply_tokens.quote_id and q.user_id = (select auth.uid()))
  );

drop policy if exists "reply_tokens_delete" on public.reply_tokens;
create policy "reply_tokens_delete" on public.reply_tokens
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.customer_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  -- Resend's id for the received email: each one is handled once.
  resend_email_id text not null unique check (char_length(resend_email_id) <= 100),
  from_email text not null check (char_length(from_email) <= 320),
  from_name text check (from_name is null or char_length(from_name) <= 200),
  subject text check (subject is null or char_length(subject) <= 300),
  -- Out-of-office and other automatic replies: forwarded, but they don't pause reminders.
  auto_reply boolean not null default false,
  received_at timestamptz not null default now(),
  forwarded_at timestamptz,
  forward_error text check (forward_error is null or char_length(forward_error) <= 300)
);
create index if not exists idx_customer_replies_user on public.customer_replies (user_id, received_at desc);
create index if not exists idx_customer_replies_quote on public.customer_replies (quote_id);

alter table public.customer_replies enable row level security;
revoke all on table public.customer_replies from authenticated, anon;
grant select, delete on table public.customer_replies to authenticated;

drop policy if exists "customer_replies_select" on public.customer_replies;
create policy "customer_replies_select" on public.customer_replies
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "customer_replies_delete" on public.customer_replies;
create policy "customer_replies_delete" on public.customer_replies
  for delete to authenticated
  using ((select auth.uid()) = user_id);

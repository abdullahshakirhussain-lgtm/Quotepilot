-- ===========================================================================
-- QuoteLoop database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Every table is scoped to auth.users via user_id and protected by RLS so that
-- a user can only ever read or write their own rows.
-- ===========================================================================

-- Helper: keep updated_at fresh on every UPDATE ------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- businesses  (one workspace per user)
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null,
  industry text not null default 'Other',
  currency text not null default 'USD',
  owner_name text not null default '',
  phone text,
  email text,
  default_follow_up_days integer[] not null default '{1,3,7,14}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_name text not null,
  company_name text,
  phone text,
  email text,
  source text,
  notes text,
  status text not null default 'new'
    check (status in ('new','contacted','quote_sent','follow_up_due','negotiating','won','lost','cold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- quotes  (each quote belongs to a lead)
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  title text not null,
  description text,
  amount numeric(14,2) not null default 0,
  currency text not null default 'USD',
  quote_date date not null default current_date,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft','sent','follow_up_due','negotiating','accepted','rejected','expired')),
  follow_up_count integer not null default 0,
  last_follow_up_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  -- How a quote the user sent themselves went out ("WhatsApp", "Phone", ...).
  -- Metadata only: it must never be mixed into the user's own notes.
  sent_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the first release; safe to re-run.
alter table public.quotes add column if not exists sent_method text;

-- ---------------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------------
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending','completed','skipped')),
  follow_up_number integer not null default 1,
  message_snapshot text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- messages  (AI-generated follow-up message history)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  message_type text not null
    check (message_type in ('first_follow_up','second_follow_up','final_follow_up','quote_expiring','objection_response','lost_lead_recovery','thank_you_after_acceptance')),
  tone text not null default 'friendly',
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_leads_user on public.leads (user_id, status);
create index if not exists idx_quotes_user on public.quotes (user_id, status);
create index if not exists idx_quotes_lead on public.quotes (lead_id);
create index if not exists idx_quotes_next_follow on public.quotes (user_id, next_follow_up_at);
create index if not exists idx_follow_ups_user on public.follow_ups (user_id, status, due_date);
create index if not exists idx_follow_ups_quote on public.follow_ups (quote_id);
create index if not exists idx_messages_quote on public.messages (quote_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_businesses_updated on public.businesses;
create trigger trg_businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated before update on public.quotes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_follow_ups_updated on public.follow_ups;
create trigger trg_follow_ups_updated before update on public.follow_ups
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- Every row must belong to the caller, AND every row it references (lead,
-- quote) must also belong to the caller. Without the reference checks a user
-- could attach rows to another tenant's lead/quote, and that tenant deleting
-- their lead would cascade-delete the attacker-linked rows.
-- `(select auth.uid())` is Supabase's recommended form (evaluated once per
-- statement instead of per row).
-- ===========================================================================
alter table public.businesses enable row level security;
alter table public.leads       enable row level security;
alter table public.quotes      enable row level security;
alter table public.follow_ups  enable row level security;
alter table public.messages    enable row level security;

-- businesses
drop policy if exists "businesses_owner" on public.businesses;
create policy "businesses_owner" on public.businesses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- leads
drop policy if exists "leads_owner" on public.leads;
create policy "leads_owner" on public.leads
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- quotes: may only reference one of the caller's own leads
drop policy if exists "quotes_owner" on public.quotes;
create policy "quotes_owner" on public.quotes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.leads l
      where l.id = quotes.lead_id and l.user_id = (select auth.uid())
    )
  );

-- follow_ups: may only reference the caller's own quote and lead
drop policy if exists "follow_ups_owner" on public.follow_ups;
create policy "follow_ups_owner" on public.follow_ups
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.quotes q
      where q.id = follow_ups.quote_id and q.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.leads l
      where l.id = follow_ups.lead_id and l.user_id = (select auth.uid())
    )
  );

-- messages: may only reference the caller's own quote (and lead, if set)
drop policy if exists "messages_owner" on public.messages;
create policy "messages_owner" on public.messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.quotes q
      where q.id = messages.quote_id and q.user_id = (select auth.uid())
    )
    and (
      messages.lead_id is null
      or exists (
        select 1 from public.leads l
        where l.id = messages.lead_id and l.user_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- email_logs: audit trail of follow-up emails sent from QuoteLoop.
-- Every send attempt is recorded BEFORE the provider is called ('pending'),
-- then marked 'sent' or 'failed'. It stays 'pending' if the provider never
-- answered clearly (e.g. a timeout), since the email may still have gone out.
-- Also used for per-user send limits. Added with manual email sending; safe
-- to re-run.
-- ===========================================================================
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Detached, not deleted, when the quote or customer goes: a record of an
  -- email that really was sent has to outlive the row it was sent about.
  quote_id uuid references public.quotes (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  follow_up_id uuid references public.follow_ups (id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'pending'
    check (status in ('pending','sent','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Added after the first release; safe to re-run. Hash of the one-time token
-- that start_email_send hands to the server: only finish_email_send, given that
-- token, can record how the send went (see below).
alter table public.email_logs add column if not exists send_token_hash text;

create index if not exists idx_email_logs_user_created on public.email_logs (user_id, created_at);
create index if not exists idx_email_logs_quote on public.email_logs (quote_id);
create index if not exists idx_email_logs_follow_up on public.email_logs (follow_up_id);

alter table public.email_logs enable row level security;

-- email_logs policies: users can read and add their own entries (referencing
-- only their own quote, lead and optional follow-up) and resolve a 'pending'
-- one, but can't edit a finished entry or delete any. That keeps the audit
-- trail and the send limits from being reset through the API. Deleting a quote
-- or customer detaches its entries rather than removing them; only deleting the
-- account itself clears them (the user_id cascade).
drop policy if exists "email_logs_owner" on public.email_logs;

drop policy if exists "email_logs_select" on public.email_logs;
create policy "email_logs_select" on public.email_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "email_logs_insert" on public.email_logs;
create policy "email_logs_insert" on public.email_logs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.quotes q
      where q.id = email_logs.quote_id and q.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.leads l
      where l.id = email_logs.lead_id and l.user_id = (select auth.uid())
    )
    and (
      email_logs.follow_up_id is null
      or exists (
        select 1 from public.follow_ups f
        where f.id = email_logs.follow_up_id and f.user_id = (select auth.uid())
      )
    )
  );

-- Only a 'pending' attempt can be resolved; finished entries are read-only.
-- Attempts started by start_email_send carry a token hash and can only be
-- resolved through finish_email_send, so this direct route is left open just
-- for entries written before that function existed.
drop policy if exists "email_logs_update" on public.email_logs;
create policy "email_logs_update" on public.email_logs
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending' and send_token_hash is null)
  with check (
    (select auth.uid()) = user_id
    and (
      email_logs.quote_id is null
      or exists (
        select 1 from public.quotes q
        where q.id = email_logs.quote_id and q.user_id = (select auth.uid())
      )
    )
    and (
      email_logs.lead_id is null
      or exists (
        select 1 from public.leads l
        where l.id = email_logs.lead_id and l.user_id = (select auth.uid())
      )
    )
    and (
      email_logs.follow_up_id is null
      or exists (
        select 1 from public.follow_ups f
        where f.id = email_logs.follow_up_id and f.user_id = (select auth.uid())
      )
    )
  );

-- Only an attempt's outcome can be written through the API. Who an email went
-- to, what it said and when it was logged are fixed once written, so neither
-- the audit trail nor the send-limit window can be rewritten. (Deleting a quote
-- or customer still clears the links: foreign-key actions aren't limited by
-- these column grants.)
revoke update on table public.email_logs from authenticated, anon;
grant update (status, provider_message_id, sent_at, error_message)
  on table public.email_logs to authenticated;

-- ===========================================================================
-- Upgrade for workspaces created before sent-email history was detachable.
-- Re-running is safe: the column changes are no-ops once applied.
-- ===========================================================================
alter table public.email_logs alter column quote_id drop not null;
alter table public.email_logs alter column lead_id drop not null;

alter table public.email_logs drop constraint if exists email_logs_quote_id_fkey;
alter table public.email_logs add constraint email_logs_quote_id_fkey
  foreign key (quote_id) references public.quotes (id) on delete set null;

alter table public.email_logs drop constraint if exists email_logs_lead_id_fkey;
alter table public.email_logs add constraint email_logs_lead_id_fkey
  foreign key (lead_id) references public.leads (id) on delete set null;

-- ===========================================================================
-- Send limits that two requests can't slip past at once.
--
-- Counting rows and then inserting takes two round trips, so two sends started
-- together could both read "24 sent today" and both go out. This does the
-- count and the insert in ONE transaction, behind a per-user advisory lock, so
-- the second attempt waits for the first and then sees it. Returns the new
-- log's id, or null when the user is already at a limit.
--
-- security invoker (the default): row-level security still applies, so this
-- can only ever count and insert the caller's own rows.
-- ===========================================================================
create or replace function public.insert_email_log_within_limits(
  p_quote_id uuid,
  p_lead_id uuid,
  p_follow_up_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_day_limit integer,
  p_month_limit integer
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Held until this transaction ends, so this user's concurrent sends queue up.
  perform pg_advisory_xact_lock(hashtext('quoteloop:email:' || v_uid::text)::bigint);

  select count(*) into v_count
  from public.email_logs
  where user_id = v_uid
    and status in ('pending', 'sent')
    and created_at >= now() - interval '24 hours';
  if v_count >= p_day_limit then
    return null;
  end if;

  select count(*) into v_count
  from public.email_logs
  where user_id = v_uid
    and status in ('pending', 'sent')
    and created_at >= now() - interval '30 days';
  if v_count >= p_month_limit then
    return null;
  end if;

  insert into public.email_logs (
    user_id, quote_id, lead_id, follow_up_id,
    recipient_email, subject, body, provider, status
  )
  values (
    v_uid, p_quote_id, p_lead_id, p_follow_up_id,
    p_recipient_email, p_subject, p_body, 'resend', 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_email_log_within_limits(
  uuid, uuid, uuid, text, text, text, integer, integer
) to authenticated;

-- ===========================================================================
-- Starting and finishing a send (replaces the function above for new code;
-- that one stays so a build deployed before this schema keeps working).
--
-- start_email_send does everything that must not race, in ONE transaction
-- behind the same per-user lock:
--   * a reminder gets one email, and a draft quote gets one quote email;
--   * the same email to the same person within p_repeat_minutes isn't sent
--     again (a second tab, a repeated submit);
--   * the send limits;
--   * the 'pending' log itself, stamped with the hash of a one-time token.
-- It returns {outcome: 'ok', id, token}, or {outcome: 'already_sent' |
-- 'repeat' | 'limit'} with nothing written.
--
-- The token goes to the server that called it and never to the browser. Only
-- finish_email_send, given that token, can record the outcome, so nobody can
-- mark an email that really went out as failed through the API (to free up
-- their send limit or rewrite the record).
--
-- start_email_send is security invoker: row-level security still applies, so
-- it can only count and insert the caller's own rows. finish_email_send is
-- security definer because direct updates of token-stamped rows are blocked;
-- it checks the caller, the pending status and the token itself.
-- ===========================================================================
create or replace function public.start_email_send(
  p_quote_id uuid,
  p_lead_id uuid,
  p_follow_up_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_day_limit integer,
  p_month_limit integer,
  p_repeat_minutes integer,
  p_quote_email boolean
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Held until this transaction ends, so this user's concurrent sends queue up.
  perform pg_advisory_xact_lock(hashtext('quoteloop:email:' || v_uid::text)::bigint);

  if p_follow_up_id is not null and exists (
    select 1 from public.email_logs
    where user_id = v_uid
      and follow_up_id = p_follow_up_id
      and status in ('pending', 'sent')
  ) then
    return jsonb_build_object('outcome', 'already_sent');
  end if;

  if coalesce(p_quote_email, false) and exists (
    select 1 from public.email_logs
    where user_id = v_uid
      and quote_id = p_quote_id
      and follow_up_id is null
      and status in ('pending', 'sent')
  ) then
    return jsonb_build_object('outcome', 'already_sent');
  end if;

  if coalesce(p_repeat_minutes, 0) > 0 and exists (
    select 1 from public.email_logs
    where user_id = v_uid
      and status in ('pending', 'sent')
      and created_at >= now() - make_interval(mins => p_repeat_minutes)
      and recipient_email = p_recipient_email
      and subject = p_subject
      and body = p_body
  ) then
    return jsonb_build_object('outcome', 'repeat');
  end if;

  if (
    select count(*) from public.email_logs
    where user_id = v_uid
      and status in ('pending', 'sent')
      and created_at >= now() - interval '24 hours'
  ) >= p_day_limit or (
    select count(*) from public.email_logs
    where user_id = v_uid
      and status in ('pending', 'sent')
      and created_at >= now() - interval '30 days'
  ) >= p_month_limit then
    return jsonb_build_object('outcome', 'limit');
  end if;

  v_token := gen_random_uuid()::text;
  insert into public.email_logs (
    user_id, quote_id, lead_id, follow_up_id,
    recipient_email, subject, body, provider, status, send_token_hash
  )
  values (
    v_uid, p_quote_id, p_lead_id, p_follow_up_id,
    p_recipient_email, p_subject, p_body, 'resend', 'pending',
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex')
  )
  returning id into v_id;

  return jsonb_build_object('outcome', 'ok', 'id', v_id, 'token', v_token);
end;
$$;

create or replace function public.finish_email_send(
  p_log_id uuid,
  p_token text,
  p_status text,
  p_provider_message_id text,
  p_error_message text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- 'pending' records an unclear outcome (e.g. a timeout) without closing it.
  if p_status is null or p_status not in ('sent', 'failed', 'pending') then
    raise exception 'invalid status';
  end if;

  update public.email_logs
  set status = p_status,
      provider_message_id = case when p_status = 'sent' then left(p_provider_message_id, 200) else provider_message_id end,
      sent_at = case when p_status = 'sent' then now() else sent_at end,
      error_message = case when p_status = 'sent' then error_message else left(p_error_message, 500) end
  where id = p_log_id
    and user_id = v_uid
    and status = 'pending'
    and send_token_hash is not null
    and send_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.start_email_send(
  uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean
) from public, anon;
grant execute on function public.start_email_send(
  uuid, uuid, uuid, text, text, text, integer, integer, integer, boolean
) to authenticated;

revoke all on function public.finish_email_send(uuid, text, text, text, text) from public, anon;
grant execute on function public.finish_email_send(uuid, text, text, text, text) to authenticated;

-- ===========================================================================
-- ai_usage: one row per AI draft, for the daily AI limit.
--
-- The limit used to be counted from `messages`, which users may edit and
-- delete (deleting a quote, "Delete all data", or the API directly), so the
-- count could be reset. These rows can only be read by their owner and only
-- written by claim_ai_draft: no insert, update or delete for anyone else.
-- Deleting a quote or "Delete all data" leaves them alone.
-- ===========================================================================
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_usage_user on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;
revoke insert, update, delete on table public.ai_usage from authenticated, anon;

drop policy if exists "ai_usage_select" on public.ai_usage;
create policy "ai_usage_select" on public.ai_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Checks the caller's last 24 hours and records one draft if under the limit,
-- in one transaction behind a per-user lock (two tabs can't both slip in).
-- Returns false at the limit. security definer: callers can't write the table
-- themselves; it only ever touches the caller's own rows.
create or replace function public.claim_ai_draft(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('quoteloop:ai:' || v_uid::text)::bigint);

  -- Old rows are no longer needed for the limit.
  delete from public.ai_usage where user_id = v_uid and created_at < now() - interval '7 days';

  select count(*) into v_count
  from public.ai_usage
  where user_id = v_uid and created_at >= now() - interval '24 hours';
  if v_count >= greatest(coalesce(p_limit, 0), 0) then
    return false;
  end if;

  insert into public.ai_usage (user_id) values (v_uid);
  return true;
end;
$$;

revoke all on function public.claim_ai_draft(integer) from public, anon;
grant execute on function public.claim_ai_draft(integer) to authenticated;

-- ===========================================================================
-- Billing: one subscription per account, a 14-day trial, and a log of payment
-- provider events. Safe to re-run.
--
-- Users can READ their own subscription and nothing else. Nobody writes these
-- rows from the browser or the API: the trial is started by start_trial()
-- (which fixes its own length), the payment provider's webhook writes through
-- the server's service role, and the owner can comp or activate an account by
-- hand with admin_set_subscription() in the SQL editor.
-- ===========================================================================
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'comped')),
  plan text not null default 'standard',
  trial_ends_at timestamptz,
  -- Paid until (active), or access until (canceled at period end).
  current_period_end timestamptz,
  -- A failed payment keeps full access until this moment.
  grace_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  -- When the newest provider event applied here happened; older events that
  -- arrive late are ignored.
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_provider_customer on public.subscriptions (provider, provider_customer_id);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
-- Read-only for signed-in users, nothing for anyone else. (Supabase's default
-- privileges also hand out TRUNCATE, which row-level security doesn't cover.)
revoke all on table public.subscriptions from authenticated, anon;
grant select on table public.subscriptions to authenticated;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Every event a payment provider sends, recorded once (its id is the key), so
-- a repeated or replayed webhook is never applied twice. Server only.
create table if not exists public.billing_events (
  id text primary key,
  provider text not null,
  type text not null,
  -- No foreign key: an event naming an account that no longer exists must still
  -- be recorded (and acknowledged), never refused and retried forever.
  user_id uuid,
  occurred_at timestamptz,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.billing_events enable row level security;
revoke all on table public.billing_events from authenticated, anon;

-- Starts the caller's 14-day trial if they have no subscription yet, and
-- returns their subscription either way. The length is fixed here, so a
-- caller can't choose a longer trial.
create or replace function public.start_trial()
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.subscriptions;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (v_uid, 'trialing', now() + interval '14 days')
  on conflict (user_id) do nothing;
  select * into v_row from public.subscriptions where user_id = v_uid;
  return v_row;
end;
$$;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- For the owner, in the SQL editor: give an account access by hand (before a
-- payment provider is connected, or to comp someone).
--   select public.admin_set_subscription('person@example.com', 'comped');
--   select public.admin_set_subscription('person@example.com', 'active', now() + interval '1 month');
--   select public.admin_set_subscription('person@example.com', 'expired');
-- Not callable from the app or the API.
create or replace function public.admin_set_subscription(
  p_email text,
  p_status text,
  p_until timestamptz default null
) returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_row public.subscriptions;
begin
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'comped') then
    raise exception 'unknown status %', p_status;
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'no account with email %', p_email;
  end if;
  insert into public.subscriptions (user_id, status, trial_ends_at, current_period_end, provider)
  values (
    v_uid, p_status,
    case when p_status = 'trialing' then coalesce(p_until, now() + interval '14 days') end,
    case when p_status in ('active', 'canceled') then p_until end,
    'manual'
  )
  on conflict (user_id) do update set
    status = excluded.status,
    trial_ends_at = case when excluded.status = 'trialing' then excluded.trial_ends_at else public.subscriptions.trial_ends_at end,
    current_period_end = case when excluded.status in ('active', 'canceled') then excluded.current_period_end else public.subscriptions.current_period_end end,
    grace_ends_at = null,
    provider = coalesce(public.subscriptions.provider, 'manual');
  select * into v_row from public.subscriptions where user_id = v_uid;
  return v_row;
end;
$$;
revoke all on function public.admin_set_subscription(text, text, timestamptz) from public, anon, authenticated;

-- ===========================================================================
-- Message templates. Safe to re-run.
--
-- QuoteLoop's ready-made templates live in the app (lib/template-library.ts).
-- message_templates holds only what a user changed or wrote: their copy of a
-- ready-made template (builtin_key set, at most one per template) or their
-- own (builtin_key null, at most 30). Bracketed words like [First name] are
-- filled in by the app; the database only stores the text.
--
-- On businesses: the sign-off and signature that end every template, and
-- which quote email template new quotes use (a ready-made key or a template id).
-- ===========================================================================
alter table public.businesses add column if not exists sign_off text
  check (sign_off is null or char_length(sign_off) <= 40);
alter table public.businesses add column if not exists signature text
  check (signature is null or char_length(signature) <= 300);
alter table public.businesses add column if not exists quote_template text
  check (quote_template is null or char_length(quote_template) <= 64);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('quote_email', 'follow_up')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  subject text check (subject is null or char_length(subject) <= 200),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  builtin_key text check (builtin_key is null or char_length(builtin_key) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_message_templates_user on public.message_templates (user_id, kind);
create unique index if not exists idx_message_templates_builtin
  on public.message_templates (user_id, builtin_key) where builtin_key is not null;

drop trigger if exists trg_message_templates_updated on public.message_templates;
create trigger trg_message_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

-- At most 30 of the user's own templates per account, counted behind a
-- per-user lock so two tabs can't both slip past the limit. Edited copies of
-- ready-made templates are limited by the unique index instead.
create or replace function public.message_templates_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.builtin_key is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('quoteloop:templates:' || new.user_id::text)::bigint);
  select count(*) into v_count
  from public.message_templates
  where user_id = new.user_id and builtin_key is null;
  if v_count >= 30 then
    raise exception 'template limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_message_templates_limit on public.message_templates;
create trigger trg_message_templates_limit before insert on public.message_templates
  for each row execute function public.message_templates_limit();

alter table public.message_templates enable row level security;
-- Only what the app needs. (Supabase's default privileges also hand out
-- TRUNCATE, which row-level security doesn't cover.)
revoke all on table public.message_templates from authenticated, anon;
grant select, insert, update, delete on table public.message_templates to authenticated;

drop policy if exists "message_templates_owner" on public.message_templates;
create policy "message_templates_owner" on public.message_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

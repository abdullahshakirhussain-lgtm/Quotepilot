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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  quote_id uuid not null references public.quotes (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
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

create index if not exists idx_email_logs_user_created on public.email_logs (user_id, created_at);
create index if not exists idx_email_logs_quote on public.email_logs (quote_id);
create index if not exists idx_email_logs_follow_up on public.email_logs (follow_up_id);

alter table public.email_logs enable row level security;

-- email_logs policies: users can read and add their own entries (referencing
-- only their own quote, lead and optional follow-up) and resolve a 'pending'
-- one, but can't edit a finished entry or delete any. That keeps the audit
-- trail and the send limits from being reset through the API. Entries still
-- go when their quote, lead or account is deleted (foreign-key cascades).
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
drop policy if exists "email_logs_update" on public.email_logs;
create policy "email_logs_update" on public.email_logs
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
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

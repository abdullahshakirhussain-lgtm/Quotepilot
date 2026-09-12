-- ===========================================================================
-- QuotePilot database schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Every table is scoped to auth.users via user_id and protected by RLS so that
-- a user can only ever read or write their own rows.
-- ===========================================================================

-- Helper: keep updated_at fresh on every UPDATE ------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- leads
drop policy if exists "leads_owner" on public.leads;
create policy "leads_owner" on public.leads
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- quotes
drop policy if exists "quotes_owner" on public.quotes;
create policy "quotes_owner" on public.quotes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- follow_ups
drop policy if exists "follow_ups_owner" on public.follow_ups;
create policy "follow_ups_owner" on public.follow_ups
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages
drop policy if exists "messages_owner" on public.messages;
create policy "messages_owner" on public.messages
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

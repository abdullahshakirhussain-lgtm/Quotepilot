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

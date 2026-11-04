-- ---------------------------------------------------------------------------
-- Admin: page visits, and the account list the admin reads (2026-11).
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

-- Which pages of QuoteLoop each account opens, when, and on what size of
-- screen. First-party only: no cookies, no IP address, no browser details, no
-- query strings (so no quote or customer ids). Kept 13 months, and deleted
-- with "Delete all data" and with the account.
create table if not exists public.app_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (char_length(path) <= 40),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  at timestamptz not null default now()
);
create index if not exists idx_app_events_user_at on public.app_events (user_id, at desc);
create index if not exists idx_app_events_at on public.app_events (at desc);
alter table public.app_events enable row level security;

-- Users never touch the table directly: they add to it through
-- log_page_view() and clear their own rows through clear_my_page_views()
-- ("Delete all data"). The admin reads it with the service role.
revoke all on table public.app_events from anon, authenticated;

-- Records one page visit for the signed-in user (called from the app's
-- middleware). Only QuoteLoop's own app pages are accepted, at most 1,000 a day
-- per account, the same page again straight away (within 30 seconds) counts
-- once, and rows
-- older than 13 months are cleared as new ones arrive.
create or replace function public.log_page_view(p_path text, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  if p_path is null
     or p_path !~ '^/(dashboard|quotes|follow-ups|pipeline|leads|settings)(/(business|messages|billing|data))?$'
     or (p_path like '/%/%' and p_path not like '/settings/%') then
    return;
  end if;
  if p_device is null or p_device not in ('phone', 'tablet', 'desktop') then
    return;
  end if;
  if (select count(*) from public.app_events where user_id = v_uid and at > now() - interval '1 day') >= 1000 then
    return;
  end if;
  -- The page just recorded, again within 30 seconds (a reload, or the page
  -- refreshing after a button), is the same visit.
  if exists (
    select 1
    from (select e.path, e.at from public.app_events e where e.user_id = v_uid order by e.at desc, e.id desc limit 1) latest
    where latest.path = p_path and latest.at > now() - interval '30 seconds'
  ) then
    return;
  end if;
  insert into public.app_events (user_id, path, device) values (v_uid, p_path, p_device);
  delete from public.app_events where user_id = v_uid and at < now() - interval '395 days';
end;
$$;
revoke all on function public.log_page_view(text, text) from public, anon;
grant execute on function public.log_page_view(text, text) to authenticated;

-- "Delete all data": removes the caller's own page visits, nobody else's.
create or replace function public.clear_my_page_views()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from public.app_events where user_id = auth.uid();
end;
$$;
revoke all on function public.clear_my_page_views() from public, anon;
grant execute on function public.clear_my_page_views() to authenticated;

-- Every account with its sign-up details, for the admin only (service role).
-- plpgsql, so the body is checked when it runs, not when it is created.
create or replace function public.admin_accounts()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at
    from auth.users u
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_accounts() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.admin_accounts() to service_role;
  end if;
end;
$$;

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

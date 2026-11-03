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

-- ---------------------------------------------------------------------------
-- When a quote was won or lost (2026-11), for "Won this month" on the
-- dashboard. Safe to run more than once.
-- ---------------------------------------------------------------------------

alter table public.quotes add column if not exists decided_at timestamptz;
create index if not exists idx_quotes_user_decided on public.quotes (user_id, decided_at desc);

-- Set by the database, never by a request: stamped when a quote becomes won or
-- lost, cleared when it's reopened, and otherwise kept as it was. Quotes
-- decided before this existed keep no date (it isn't known, so it isn't made up).
create or replace function public.set_quote_decided_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('accepted', 'rejected') then
    if tg_op = 'INSERT' or old.status is distinct from new.status then
      new.decided_at := now();
    else
      new.decided_at := old.decided_at;
    end if;
  else
    new.decided_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_decided_at on public.quotes;
create trigger quotes_decided_at
  before insert or update on public.quotes
  for each row execute function public.set_quote_decided_at();

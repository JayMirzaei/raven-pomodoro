-- Raven: profiles + append-only pomodoro completion log

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.pomodoros (
  id uuid primary key,                              -- client-generated; safe to upsert on retry
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_seconds integer not null default 1500,    -- 25 * 60
  device_id text,
  created_at timestamptz not null default now()
);

create index if not exists pomodoros_user_completed_idx
  on public.pomodoros (user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.pomodoros enable row level security;

create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "pomodoros_select_own" on public.pomodoros
  for select using (auth.uid() = user_id);

create policy "pomodoros_insert_own" on public.pomodoros
  for insert with check (auth.uid() = user_id);

-- Counts for today / this week / all-time, using caller-supplied local-time
-- boundaries so "today" matches the user's own clock, not the server's UTC day.
create or replace function public.pomodoro_counts(
  today_start timestamptz,
  week_start timestamptz
)
returns table (today_count bigint, week_count bigint, all_time_count bigint)
language sql
security invoker
as $$
  select
    count(*) filter (where completed_at >= today_start) as today_count,
    count(*) filter (where completed_at >= week_start) as week_count,
    count(*) as all_time_count
  from public.pomodoros
  where user_id = auth.uid();
$$;

-- Pin the search_path of pomodoro_counts (Supabase's database linter flags
-- functions with a mutable search_path). The function already qualifies
-- every name (public.pomodoros, auth.uid()), so behaviour is unchanged.
-- Optional hardening on top of 20260911_init.sql; safe to re-run.
alter function public.pomodoro_counts(timestamptz, timestamptz) set search_path = '';

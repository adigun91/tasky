-- Tasky cloud schema: run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS).

-- ─── profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'You',
  email text not null default '',
  avatar_color text not null default '#4F46E5',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are self-accessible" on public.profiles;
create policy "profiles are self-accessible" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─── settings ───────────────────────────────────────────────────────────────
create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_snooze_minutes int not null default 9,
  default_alarm_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings are self-accessible" on public.settings;
create policy "settings are self-accessible" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── tasks ──────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  date text not null default to_char(now(), 'YYYY-MM-DD'),
  time text not null default '09:00',
  repeat text not null default 'daily' check (repeat in ('once', 'daily', 'weekly', 'hourly')),
  weekdays int[] not null default '{}',
  interval_hours int not null default 1,
  alarm_enabled boolean not null default true,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

alter table public.tasks enable row level security;

drop policy if exists "tasks are self-accessible" on public.tasks;
create policy "tasks are self-accessible" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lets every device subscribed to this table receive realtime INSERT/UPDATE/DELETE events.
alter publication supabase_realtime add table public.tasks;

-- REQUIRED for DELETE events to reach subscribers: without FULL identity, the "old row" sent
-- with a DELETE only contains the primary key (no user_id), so Realtime's RLS check can't
-- authorize the broadcast and silently drops it — inserts/updates still work, deletes don't.
alter table public.tasks replica identity full;

-- ─── push_tokens ────────────────────────────────────────────────────────────
-- One row per device; the scheduled Edge Function reads these to send pushes.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  device_name text,
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.push_tokens enable row level security;

drop policy if exists "push tokens are self-accessible" on public.push_tokens;
create policy "push tokens are self-accessible" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── auto-provision profile + settings on signup ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── keep updated_at fresh ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
  before update on public.settings
  for each row execute procedure public.set_updated_at();

-- ─── scheduling the push-notification Edge Function ────────────────────────
-- After running `supabase functions deploy send-due-notifications`, schedule it to run every
-- minute. Easiest path: Dashboard -> Edge Functions -> send-due-notifications -> Cron -> add a
-- "every 1 minute" trigger. Alternatively, with the pg_cron + pg_net extensions enabled, run:
--
-- select cron.schedule(
--   'send-due-notifications',
--   '* * * * *',
--   $$ select net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/send-due-notifications',
--     headers := jsonb_build_object('Authorization', 'Bearer <your-service-role-key>')
--   ) $$
-- );

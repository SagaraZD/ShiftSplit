-- ShiftSplit — Supabase database setup
-- Run this whole script once in the Supabase SQL Editor (Project → SQL Editor → New query).

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- locations
-- ============================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_code text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius integer not null default 150,
  created_at timestamptz not null default now()
);

comment on table public.locations is 'Office sites tracked for geofenced clock-in/out (e.g. Mangere, Highbrook).';

-- ============================================================================
-- work_logs
-- ============================================================================
create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer generated always as (
    case
      when end_time is not null then round(extract(epoch from (end_time - start_time)) / 60)::integer
      else null
    end
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_logs_end_after_start check (end_time is null or end_time > start_time)
);

create index if not exists work_logs_user_id_idx on public.work_logs (user_id);
create index if not exists work_logs_start_time_idx on public.work_logs (start_time);
-- Enforce a single open (still clocked-in) session per user.
create unique index if not exists work_logs_one_open_session_per_user
  on public.work_logs (user_id)
  where end_time is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists work_logs_set_updated_at on public.work_logs;
create trigger work_logs_set_updated_at
  before update on public.work_logs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- profiles
-- Public-facing profile data (display name, avatar) for each auth user.
-- Kept separate from auth.users so it's a normal, queryable public table.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing profile data (display name, avatar) for each auth user.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Seed the two NZ office locations with stable, well-known IDs so the app can
-- reference them directly (see src/constants/locations.ts). Replace the
-- lat/lng below with your exact office coordinates before going live.
-- ============================================================================
insert into public.locations (id, name, color_code, latitude, longitude, radius)
values
  ('00000000-0000-0000-0000-000000000001', 'Mangere', '#6366F1', -36.9772, 174.8069, 150),
  ('00000000-0000-0000-0000-000000000002', 'Highbrook', '#06B6D4', -36.9436, 174.9106, 150)
on conflict (id) do update set
  name = excluded.name,
  color_code = excluded.color_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius = excluded.radius;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.locations enable row level security;
alter table public.work_logs enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Locations are readable by authenticated users" on public.locations;
create policy "Locations are readable by authenticated users"
  on public.locations for select
  to authenticated
  using (true);

drop policy if exists "Users can view own work logs" on public.work_logs;
create policy "Users can view own work logs"
  on public.work_logs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own work logs" on public.work_logs;
create policy "Users can insert own work logs"
  on public.work_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own work logs" on public.work_logs;
create policy "Users can update own work logs"
  on public.work_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own work logs" on public.work_logs;
create policy "Users can delete own work logs"
  on public.work_logs for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================================
-- Auto-create a profile row whenever a new auth user signs up, and backfill
-- one for any accounts created before this table existed.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, raw_user_meta_data ->> 'display_name' from auth.users
on conflict (id) do nothing;

-- ============================================================================
-- Realtime (dashboard live-updates when a session is clocked in/out elsewhere)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'work_logs'
  ) then
    alter publication supabase_realtime add table public.work_logs;
  end if;
end $$;

-- ============================================================================
-- RPC: get_weekly_summary
-- Returns one row per location plus the week's totals, target and overtime.
-- Runs as SECURITY INVOKER (the default) so the row_level security policies
-- above still apply — a caller can only ever see their own work_logs, even if
-- they pass a different p_user_id.
-- ============================================================================
create or replace function public.get_weekly_summary(p_user_id uuid, p_start_date date)
returns table (
  location_id uuid,
  location_name text,
  color_code text,
  total_minutes bigint,
  week_total_minutes bigint,
  target_minutes integer,
  percent_of_location numeric,
  percent_of_target numeric,
  overtime_minutes bigint
)
language sql
stable
as $$
  with week_bounds as (
    -- The work week is Monday through Friday; p_start_date is always a Monday.
    select p_start_date::timestamptz as week_start,
           (p_start_date + interval '5 days')::timestamptz as week_end
  ),
  logs as (
    select wl.location_id, wl.duration_minutes
    from public.work_logs wl, week_bounds wb
    where wl.user_id = p_user_id
      and wl.start_time >= wb.week_start
      and wl.start_time < wb.week_end
      and wl.duration_minutes is not null
  ),
  per_location as (
    select l.id as location_id, l.name as location_name, l.color_code,
           coalesce(sum(logs.duration_minutes), 0)::bigint as total_minutes
    from public.locations l
    left join logs on logs.location_id = l.id
    group by l.id, l.name, l.color_code
  ),
  totals as (
    select coalesce(sum(total_minutes), 0)::bigint as week_total_minutes
    from per_location
  )
  select
    per_location.location_id,
    per_location.location_name,
    per_location.color_code,
    per_location.total_minutes,
    totals.week_total_minutes,
    2400 as target_minutes, -- 40 hours * 60 minutes
    round((per_location.total_minutes::numeric / nullif(totals.week_total_minutes, 0)) * 100, 1) as percent_of_location,
    round((per_location.total_minutes::numeric / 2400) * 100, 1) as percent_of_target,
    greatest(totals.week_total_minutes - 2400, 0)::bigint as overtime_minutes
  from per_location, totals
  order by per_location.location_name;
$$;

grant execute on function public.get_weekly_summary(uuid, date) to authenticated;

-- ============================================================================
-- Storage: avatars bucket
-- Profile photos are stored at "<user id>/<filename>" inside a public bucket,
-- so avatar URLs can be used directly as <Image source={{ uri }}> without
-- extra signing. Writes are restricted to the owning user via the folder-name
-- prefix in the storage path.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Cron: weekly summary email, every Friday
-- Calls the "weekly-summary-email" Edge Function (see supabase/functions/),
-- which emails every user their hours-worked summary for the current week.
--
-- REPLACE the two placeholders below before running this section:
--   <PROJECT_REF>         — your Supabase project ref (Project Settings → General).
--   <SERVICE_ROLE_KEY>    — Project Settings → API → service_role key (keep secret).
--
-- The schedule below is '0 0 * * 5' = 00:00 UTC every Friday = 12:00pm NZST
-- (UTC+12). NZ Daylight Time (UTC+13, roughly late Sep–early Apr) shifts
-- local delivery to 1pm during that period — pg_cron always runs in UTC and
-- does not auto-adjust for the target timezone's DST. Change the cron
-- expression if you want a different local time.
-- ============================================================================
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('weekly-summary-email-friday');
exception when others then
  null; -- job didn't exist yet on first run
end $$;

select cron.schedule(
  'weekly-summary-email-friday',
  '0 0 * * 5',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-summary-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

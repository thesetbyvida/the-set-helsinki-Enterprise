-- The Set Helsinki Enterprise 2.0 — Phase 6 HourCalc / TES special days
-- Run after 005_rota.sql.

create table if not exists public.tes_special_days (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('holiday','eve')),
  label text not null,
  premium_start time not null default '00:00',
  premium_end time not null default '00:00',
  created_at timestamptz not null default now(),
  constraint tes_special_day_unique unique(date, kind, label)
);

create index if not exists tes_special_days_date_idx on public.tes_special_days(date);
alter table public.tes_special_days enable row level security;

drop policy if exists "tes special days read" on public.tes_special_days;
create policy "tes special days read" on public.tes_special_days
for select to authenticated using (true);

drop policy if exists "tes special days write admin" on public.tes_special_days;
create policy "tes special days write admin" on public.tes_special_days
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- IMPORTANT:
-- Phase 6 intentionally does not hard-code collective-agreement premium dates/times.
-- Add the official holiday/eve rows used by your current TES before payroll is enabled.
-- premium_start = premium_end means the whole calendar day.
-- Example only (replace with the dates/rules you actually use):
-- insert into public.tes_special_days(date,kind,label,premium_start,premium_end)
-- values ('2026-12-25','holiday','Christmas Day','00:00','00:00')
-- on conflict do nothing;

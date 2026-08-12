-- The Set Helsinki Enterprise 2.0 — Phase 7 Payroll (21st–20th)
-- Run after 006_hourcalc.sql.
-- Premium euro rates are intentionally configurable per restaurant instead of hard-coded.

create table if not exists public.payroll_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  period_start_day integer not null default 21 check (period_start_day between 1 and 28),
  evening_eur_per_hour numeric(10,4) not null default 0,
  night_eur_per_hour numeric(10,4) not null default 0,
  eve_eur_per_hour numeric(10,4) not null default 0,
  updated_at timestamptz not null default now()
);

-- Defensive authorization helper: this makes Phase 7 safe even if the
-- Phase 4 helper was not previously installed in this Supabase project.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('super_admin','admin'), false);
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

alter table public.payroll_settings enable row level security;

drop policy if exists "payroll settings read" on public.payroll_settings;
create policy "payroll settings read" on public.payroll_settings
for select to authenticated using (true);

drop policy if exists "payroll settings write admin" on public.payroll_settings;
create policy "payroll settings write admin" on public.payroll_settings
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- Create a settings row for every existing restaurant. Rates remain zero until
-- an admin enters the official current TES euro supplements used by the company.
insert into public.payroll_settings (restaurant_id)
select id from public.restaurants
on conflict (restaurant_id) do nothing;

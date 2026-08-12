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

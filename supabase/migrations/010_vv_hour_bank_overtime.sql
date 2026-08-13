-- The Set Helsinki Enterprise 3.4 — VV / Vuosivapaa + Hour Bank + Overtime base
-- Run after 009_employee_order_rpc.sql.
-- The default company rule is 200 worked hours = 1 VV, maximum 9 VV per calendar year.
-- Confirm these defaults against the applicable current TES/company policy before payroll use.

create table if not exists public.vv_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  hours_per_vv numeric(10,2) not null default 200 check (hours_per_vv > 0),
  max_vv_per_year integer not null default 9 check (max_vv_per_year between 0 and 50),
  updated_at timestamptz not null default now()
);

create table if not exists public.vv_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  effective_date date not null default current_date,
  vv_delta numeric(10,2) not null default 0,
  bank_hours_delta numeric(10,2) not null default 0,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vv_adjustments_employee_date_idx
  on public.vv_adjustments(employee_id, effective_date);
create index if not exists vv_adjustments_restaurant_date_idx
  on public.vv_adjustments(restaurant_id, effective_date);

create table if not exists public.overtime_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  contract_hours numeric(10,2) not null default 0,
  worked_hours numeric(10,2) not null default 0,
  overtime_hours numeric(10,2) not null default 0,
  bank_delta numeric(10,2) not null default 0,
  calculated_at timestamptz not null default now(),
  constraint overtime_period_unique unique(employee_id, restaurant_id, period_start, period_end)
);

alter table public.vv_settings enable row level security;
alter table public.vv_adjustments enable row level security;
alter table public.overtime_periods enable row level security;

drop policy if exists "vv settings read" on public.vv_settings;
create policy "vv settings read" on public.vv_settings
for select to authenticated using (true);

drop policy if exists "vv settings write admin" on public.vv_settings;
create policy "vv settings write admin" on public.vv_settings
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "vv adjustments read" on public.vv_adjustments;
create policy "vv adjustments read" on public.vv_adjustments
for select to authenticated using (true);

drop policy if exists "vv adjustments write admin" on public.vv_adjustments;
create policy "vv adjustments write admin" on public.vv_adjustments
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "overtime periods read" on public.overtime_periods;
create policy "overtime periods read" on public.overtime_periods
for select to authenticated using (true);

drop policy if exists "overtime periods write admin" on public.overtime_periods;
create policy "overtime periods write admin" on public.overtime_periods
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

insert into public.vv_settings (restaurant_id)
select id from public.restaurants
on conflict (restaurant_id) do nothing;

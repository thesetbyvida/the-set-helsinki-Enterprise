-- The Set Helsinki Enterprise 3.5 — Payroll PRO
-- Run after 010_vv_hour_bank_overtime.sql.
-- Overtime supplement is deliberately configurable. Base hourly pay already covers all worked hours;
-- this setting is ONLY the extra overtime supplement €/h used by the company.

alter table public.payroll_settings
  add column if not exists overtime_eur_per_hour numeric(10,4) not null default 0;

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payroll_date date not null,
  amount numeric(12,2) not null default 0,
  label text not null default '',
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payroll_adjustments_restaurant_date_idx
  on public.payroll_adjustments(restaurant_id, payroll_date);
create index if not exists payroll_adjustments_employee_date_idx
  on public.payroll_adjustments(employee_id, payroll_date);

alter table public.payroll_adjustments enable row level security;

drop policy if exists "payroll adjustments read" on public.payroll_adjustments;
create policy "payroll adjustments read" on public.payroll_adjustments
for select to authenticated using (true);

drop policy if exists "payroll adjustments write admin" on public.payroll_adjustments;
create policy "payroll adjustments write admin" on public.payroll_adjustments
for all to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

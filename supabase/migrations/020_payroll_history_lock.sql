-- The Set Helsinki Enterprise 4.5 — Payroll history, closing and period locks
-- Run after 019_payroll_tes_2026.sql.

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  rows_snapshot jsonb not null default '[]'::jsonb,
  totals_snapshot jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_period_dates check (period_end >= period_start),
  constraint payroll_period_unique unique (restaurant_id, period_start, period_end)
);

create index if not exists payroll_periods_restaurant_start_idx
  on public.payroll_periods(restaurant_id, period_start desc);

alter table public.payroll_periods enable row level security;

drop policy if exists "payroll periods read" on public.payroll_periods;
create policy "payroll periods read" on public.payroll_periods
for select to authenticated
using (public.can_access_restaurant(restaurant_id));

drop policy if exists "payroll periods write admin" on public.payroll_periods;
create policy "payroll periods write admin" on public.payroll_periods
for all to authenticated
using (public.is_app_admin() and public.can_access_restaurant(restaurant_id))
with check (public.is_app_admin() and public.can_access_restaurant(restaurant_id));

create or replace function public.is_payroll_date_locked(target_restaurant uuid, target_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payroll_periods pp
    where pp.restaurant_id = target_restaurant
      and pp.status = 'closed'
      and target_date between pp.period_start and pp.period_end
  );
$$;

revoke all on function public.is_payroll_date_locked(uuid,date) from public;
grant execute on function public.is_payroll_date_locked(uuid,date) to authenticated;

-- Closed payroll periods freeze rota rows inside that payroll date range.
drop policy if exists "rota shifts insert" on public.rota_shifts;
create policy "rota shifts insert" on public.rota_shifts
for insert to authenticated
with check (
  public.can_edit_rota(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, shift_date)
);

drop policy if exists "rota shifts update" on public.rota_shifts;
create policy "rota shifts update" on public.rota_shifts
for update to authenticated
using (
  public.can_edit_rota(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, shift_date)
)
with check (
  public.can_edit_rota(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, shift_date)
);

drop policy if exists "rota shifts delete" on public.rota_shifts;
create policy "rota shifts delete" on public.rota_shifts
for delete to authenticated
using (
  public.can_edit_rota(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, shift_date)
);

-- Adjustments are frozen too once the period is closed.
drop policy if exists "payroll adjustments write admin" on public.payroll_adjustments;
create policy "payroll adjustments write admin" on public.payroll_adjustments
for all to authenticated
using (
  public.is_app_admin()
  and not public.is_payroll_date_locked(restaurant_id, payroll_date)
)
with check (
  public.is_app_admin()
  and not public.is_payroll_date_locked(restaurant_id, payroll_date)
);

-- The Set Helsinki Enterprise 3.8 — Dashboard PRO
-- Daily sales are intentionally stored separately from payroll so the dashboard
-- can calculate sales/hour and labor-cost percentage by restaurant.

create table if not exists public.sales_daily (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sales_date date not null,
  net_sales numeric(12,2) not null default 0 check (net_sales >= 0),
  gross_sales numeric(12,2) not null default 0 check (gross_sales >= 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, sales_date)
);

create index if not exists sales_daily_restaurant_date_idx
  on public.sales_daily(restaurant_id, sales_date);

alter table public.sales_daily enable row level security;

drop policy if exists sales_daily_select_authenticated on public.sales_daily;
drop policy if exists sales_daily_write_admin on public.sales_daily;

create policy sales_daily_select_authenticated
on public.sales_daily
for select
to authenticated
using (true);

create policy sales_daily_write_admin
on public.sales_daily
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

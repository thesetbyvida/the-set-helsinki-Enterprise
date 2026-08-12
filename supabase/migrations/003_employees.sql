-- The Set Helsinki Enterprise 2.0 — Phase 3 Employees
-- Run after 001_foundation.sql and 002_restaurants.sql.

create table if not exists public.employees(
  id uuid primary key default gen_random_uuid(),
  employee_number text,
  name text not null,
  email text,
  phone text,
  address text,
  birth_date date,
  job_title text,
  contract_type text not null default '112.5h'
    check(contract_type in ('112.5h','0h','monthly')),
  contract_hours numeric(10,2) not null default 112.5,
  hourly_rate numeric(10,2) not null default 0,
  monthly_salary numeric(12,2) not null default 0,
  bank_hours numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists employee_number text;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists address text;
alter table public.employees add column if not exists birth_date date;
alter table public.employees add column if not exists job_title text;
alter table public.employees add column if not exists contract_type text not null default '112.5h';
alter table public.employees add column if not exists contract_hours numeric(10,2) not null default 112.5;
alter table public.employees add column if not exists hourly_rate numeric(10,2) not null default 0;
alter table public.employees add column if not exists monthly_salary numeric(12,2) not null default 0;
alter table public.employees add column if not exists bank_hours numeric(10,2) not null default 0;
alter table public.employees add column if not exists active boolean not null default true;
alter table public.employees add column if not exists updated_at timestamptz not null default now();

create unique index if not exists employees_employee_number_unique
on public.employees(employee_number)
where employee_number is not null;

create table if not exists public.employee_restaurants(
  employee_id uuid not null references public.employees(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_order integer not null default 999,
  primary key(employee_id, restaurant_id)
);

alter table public.employees enable row level security;
alter table public.employee_restaurants enable row level security;

drop policy if exists employees_select_authenticated on public.employees;
drop policy if exists employees_write_admin on public.employees;
drop policy if exists employee_restaurants_select_authenticated on public.employee_restaurants;
drop policy if exists employee_restaurants_write_admin on public.employee_restaurants;

create policy employees_select_authenticated
on public.employees for select
to authenticated
using (true);

create policy employees_write_admin
on public.employees for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
);

create policy employee_restaurants_select_authenticated
on public.employee_restaurants for select
to authenticated
using (true);

create policy employee_restaurants_write_admin
on public.employee_restaurants for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
);

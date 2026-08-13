-- Enterprise 3.6 Employee App foundation
create index if not exists idx_employees_email_lower
  on public.employees (lower(email));

create index if not exists idx_rota_shifts_employee_date
  on public.rota_shifts (employee_id, shift_date);

create table if not exists public.employee_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type text not null check (request_type in ('vacation','shift_change','availability','other')),
  start_date date,
  end_date date,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_requests enable row level security;

drop policy if exists "employee_requests_select_own_or_admin" on public.employee_requests;
create policy "employee_requests_select_own_or_admin"
on public.employee_requests
for select
using (
  public.is_app_admin()
  or exists (
    select 1 from public.employees e
    where e.id = employee_requests.employee_id
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
);

drop policy if exists "employee_requests_insert_own_or_admin" on public.employee_requests;
create policy "employee_requests_insert_own_or_admin"
on public.employee_requests
for insert
with check (
  public.is_app_admin()
  or exists (
    select 1 from public.employees e
    where e.id = employee_requests.employee_id
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
);

drop policy if exists "employee_requests_update_admin" on public.employee_requests;
create policy "employee_requests_update_admin"
on public.employee_requests
for update
using (public.is_app_admin())
with check (public.is_app_admin());

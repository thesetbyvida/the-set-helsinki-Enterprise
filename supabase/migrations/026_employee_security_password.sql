-- The Set Helsinki Enterprise 6.3 — Employee security + invitation password setup
-- Run after 025_employee_user_integration.sql.
-- Protects employee records from other employees and exposes only a safe directory for the rota.

-- Employees may no longer select every employee record (which includes salary/private fields).
drop policy if exists employees_select_authenticated on public.employees;
drop policy if exists "employees scoped read 6.3" on public.employees;
create policy "employees scoped read 6.3"
on public.employees for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  or auth_user_id = auth.uid()
);

-- Employee/restaurant assignment table: admin/manager can read it directly.
-- Employees use the safe directory RPC below instead of receiving unrestricted assignment rows.
drop policy if exists employee_restaurants_select_authenticated on public.employee_restaurants;
drop policy if exists "employee restaurants scoped read 6.3" on public.employee_restaurants;
create policy "employee restaurants scoped read 6.3"
on public.employee_restaurants for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  or exists (
    select 1 from public.employees e
    where e.id = employee_restaurants.employee_id
      and e.auth_user_id = auth.uid()
  )
);

-- Safe rota directory. It intentionally returns no email, phone, address,
-- hourly rate, monthly salary, contract data or bank balance.
create or replace function public.rota_employee_directory()
returns table(
  id uuid,
  name text,
  job_title text,
  active boolean,
  restaurant_id uuid,
  display_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.job_title, e.active, er.restaurant_id, er.display_order
  from public.employee_restaurants er
  join public.employees e on e.id = er.employee_id
  where e.active = true
    and public.can_access_restaurant(er.restaurant_id)
  order by er.restaurant_id, er.display_order, e.name;
$$;

revoke all on function public.rota_employee_directory() from public;
grant execute on function public.rota_employee_directory() to authenticated;

-- Financial tables remain admin-scoped. Re-assert the most important policies so
-- employee sessions cannot read payroll even if older migrations were partially applied.
drop policy if exists "payroll settings read" on public.payroll_settings;
create policy "payroll settings read"
on public.payroll_settings for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll adjustments read" on public.payroll_adjustments;
create policy "payroll adjustments read"
on public.payroll_adjustments for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll periods read" on public.payroll_periods;
create policy "payroll periods read"
on public.payroll_periods for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

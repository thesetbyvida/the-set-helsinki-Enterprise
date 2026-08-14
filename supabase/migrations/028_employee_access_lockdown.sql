-- The Set Helsinki Enterprise 6.3.3 — Employee Access Lockdown
-- Run after 027_employee_mywork_security.sql.
-- Employees may read the full rota of their assigned restaurant(s), but cannot read
-- restaurant administration, payroll, sales/POS or other employees' private data.

-- Safe restaurant list for the rota. No address, phone, email, opening hours or admin fields.
create or replace function public.rota_restaurant_directory()
returns table(id uuid, name text, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, r.active
  from public.restaurants r
  where r.active = true
    and public.can_access_restaurant(r.id)
  order by r.name;
$$;
revoke all on function public.rota_restaurant_directory() from public;
grant execute on function public.rota_restaurant_directory() to authenticated;

-- Direct restaurant-table reads are administrative only. Employees use the safe RPC above.
drop policy if exists restaurants_select_authenticated on public.restaurants;
drop policy if exists "restaurants scoped read" on public.restaurants;
drop policy if exists "restaurants admin read 6.3.3" on public.restaurants;
create policy "restaurants admin read 6.3.3"
on public.restaurants for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  and public.can_access_restaurant(id)
);

-- Rota remains readable by any authenticated user assigned to that restaurant.
drop policy if exists "rota periods read" on public.rota_periods;
create policy "rota periods read" on public.rota_periods
for select to authenticated
using (public.can_access_restaurant(restaurant_id));

drop policy if exists "rota shifts read" on public.rota_shifts;
create policy "rota shifts read" on public.rota_shifts
for select to authenticated
using (public.can_access_restaurant(restaurant_id));

-- Employees must never read restaurant sales or POS data.
drop policy if exists sales_daily_select_authenticated on public.sales_daily;
drop policy if exists "sales daily staff read 6.3.3" on public.sales_daily;
create policy "sales daily staff read 6.3.3"
on public.sales_daily for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  and public.can_access_restaurant(restaurant_id)
);

drop policy if exists pos_sales_staff_select on public.pos_sales;
drop policy if exists "pos sales staff read 6.3.3" on public.pos_sales;
create policy "pos sales staff read 6.3.3"
on public.pos_sales for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  and public.can_access_restaurant(restaurant_id)
);

-- POS import history is administrative only.
drop policy if exists pos_import_jobs_admin_all on public.pos_import_jobs;
drop policy if exists "pos import staff all 6.3.3" on public.pos_import_jobs;
create policy "pos import staff all 6.3.3"
on public.pos_import_jobs for all to authenticated
using (public.current_user_role() in ('super_admin','admin','manager'))
with check (public.current_user_role() in ('super_admin','admin','manager'));

-- VV configuration itself is management information. Employee My Work calculates only
-- the employee's own VV result and keeps the scoped adjustment policy from 6.3.2.
drop policy if exists "vv settings read" on public.vv_settings;
drop policy if exists "vv settings staff read 6.3.3" on public.vv_settings;
create policy "vv settings staff read 6.3.3"
on public.vv_settings for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  and public.can_access_restaurant(restaurant_id)
);

-- Re-assert payroll privacy. Employees receive no rows from these tables.
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

-- Private employee table: management may read all accessible records; employees only themselves.
drop policy if exists "employees scoped read 6.3" on public.employees;
drop policy if exists "employees locked read 6.3.3" on public.employees;
create policy "employees locked read 6.3.3"
on public.employees for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  or auth_user_id = auth.uid()
);

-- Keep the safe rota directory available to employees for all colleagues in assigned restaurants.
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

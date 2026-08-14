-- The Set Helsinki Enterprise 6.3.2
-- Employee My Work privacy hardening.
-- Employees may read only their own VV adjustments and overtime rows.

drop policy if exists "vv adjustments read" on public.vv_adjustments;
drop policy if exists "vv adjustments scoped read 6.3.2" on public.vv_adjustments;
create policy "vv adjustments scoped read 6.3.2"
on public.vv_adjustments for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  or exists (
    select 1 from public.employees e
    where e.id = vv_adjustments.employee_id and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "overtime periods read" on public.overtime_periods;
drop policy if exists "overtime periods scoped read 6.3.2" on public.overtime_periods;
create policy "overtime periods scoped read 6.3.2"
on public.overtime_periods for select to authenticated
using (
  public.current_user_role() in ('super_admin','admin','manager')
  or exists (
    select 1 from public.employees e
    where e.id = overtime_periods.employee_id and e.auth_user_id = auth.uid()
  )
);

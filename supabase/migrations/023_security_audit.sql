-- The Set Helsinki Enterprise 4.9 — Security & Audit
-- Run after 022_employee_self_service.sql.
-- Hardens restaurant-scoped permissions, protects payroll data, and adds automatic audit events.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

create or replace function public.can_manage_restaurant(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or (
      public.current_user_role() = 'admin'
      and exists (
        select 1 from public.user_restaurants ur
        where ur.user_id = auth.uid()
          and ur.restaurant_id = target_restaurant
      )
    );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
revoke all on function public.can_manage_restaurant(uuid) from public;
grant execute on function public.can_manage_restaurant(uuid) to authenticated;

-- Restaurants: super admin sees all, other users only assigned restaurants.
drop policy if exists restaurants_select_authenticated on public.restaurants;
drop policy if exists "restaurants scoped read" on public.restaurants;
create policy "restaurants scoped read"
on public.restaurants for select to authenticated
using (public.can_access_restaurant(id));

-- Only super admin may create/delete restaurants. Assigned admins may edit their restaurants.
drop policy if exists restaurants_write_admin on public.restaurants;
drop policy if exists "restaurants insert superadmin" on public.restaurants;
drop policy if exists "restaurants update manager" on public.restaurants;
drop policy if exists "restaurants delete superadmin" on public.restaurants;
create policy "restaurants insert superadmin"
on public.restaurants for insert to authenticated
with check (public.is_super_admin());
create policy "restaurants update manager"
on public.restaurants for update to authenticated
using (public.can_manage_restaurant(id))
with check (public.can_manage_restaurant(id));
create policy "restaurants delete superadmin"
on public.restaurants for delete to authenticated
using (public.is_super_admin());

-- Financial and payroll tables are never globally readable.
drop policy if exists "payroll settings read" on public.payroll_settings;
create policy "payroll settings read"
on public.payroll_settings for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll settings write admin" on public.payroll_settings;
create policy "payroll settings write admin"
on public.payroll_settings for all to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll adjustments read" on public.payroll_adjustments;
create policy "payroll adjustments read"
on public.payroll_adjustments for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll adjustments write admin" on public.payroll_adjustments;
create policy "payroll adjustments write admin"
on public.payroll_adjustments for all to authenticated
using (
  public.can_manage_restaurant(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, payroll_date)
)
with check (
  public.can_manage_restaurant(restaurant_id)
  and not public.is_payroll_date_locked(restaurant_id, payroll_date)
);

drop policy if exists "payroll periods read" on public.payroll_periods;
create policy "payroll periods read"
on public.payroll_periods for select to authenticated
using (public.can_manage_restaurant(restaurant_id));

drop policy if exists "payroll periods write admin" on public.payroll_periods;
create policy "payroll periods write admin"
on public.payroll_periods for all to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

-- Sales are scoped to assigned restaurants; admin/manager writes stay restaurant-scoped.
drop policy if exists sales_daily_select_authenticated on public.sales_daily;
create policy sales_daily_select_authenticated
on public.sales_daily for select to authenticated
using (public.can_access_restaurant(restaurant_id));

drop policy if exists sales_daily_write_admin on public.sales_daily;
create policy sales_daily_write_admin
on public.sales_daily for all to authenticated
using (
  public.can_manage_restaurant(restaurant_id)
  or (public.current_user_role() = 'manager' and public.can_access_restaurant(restaurant_id))
)
with check (
  public.can_manage_restaurant(restaurant_id)
  or (public.current_user_role() = 'manager' and public.can_access_restaurant(restaurant_id))
);

-- VV/overtime reads are restaurant-scoped. Writes remain admin-only for the assigned restaurant.
drop policy if exists "vv settings read" on public.vv_settings;
create policy "vv settings read" on public.vv_settings
for select to authenticated using (public.can_access_restaurant(restaurant_id));

drop policy if exists "vv settings write admin" on public.vv_settings;
create policy "vv settings write admin" on public.vv_settings
for all to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

drop policy if exists "vv adjustments read" on public.vv_adjustments;
create policy "vv adjustments read" on public.vv_adjustments
for select to authenticated
using (restaurant_id is null or public.can_access_restaurant(restaurant_id));

drop policy if exists "vv adjustments write admin" on public.vv_adjustments;
create policy "vv adjustments write admin" on public.vv_adjustments
for all to authenticated
using (restaurant_id is null and public.is_super_admin() or public.can_manage_restaurant(restaurant_id))
with check (restaurant_id is null and public.is_super_admin() or public.can_manage_restaurant(restaurant_id));

drop policy if exists "overtime periods read" on public.overtime_periods;
create policy "overtime periods read" on public.overtime_periods
for select to authenticated using (public.can_access_restaurant(restaurant_id));

drop policy if exists "overtime periods write admin" on public.overtime_periods;
create policy "overtime periods write admin" on public.overtime_periods
for all to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

-- POS import jobs also obey restaurant assignment.
drop policy if exists pos_import_jobs_admin_all on public.pos_import_jobs;
create policy pos_import_jobs_admin_all on public.pos_import_jobs
for all to authenticated
using (
  public.can_manage_restaurant(restaurant_id)
  or (public.current_user_role() = 'manager' and public.can_access_restaurant(restaurant_id))
)
with check (
  public.can_manage_restaurant(restaurant_id)
  or (public.current_user_role() = 'manager' and public.can_access_restaurant(restaurant_id))
);

-- Audit visibility: super admin sees everything; admin sees only own assigned restaurants
-- plus own non-restaurant events.
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select
on public.audit_log for select to authenticated
using (
  public.is_super_admin()
  or (
    public.current_user_role() = 'admin'
    and (
      (restaurant_id is not null and public.can_manage_restaurant(restaurant_id))
      or (restaurant_id is null and actor_user_id = auth.uid())
    )
  )
);

-- Clients cannot spoof actor_user_id.
drop policy if exists audit_log_authenticated_insert on public.audit_log;
create policy audit_log_authenticated_insert
on public.audit_log for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and (restaurant_id is null or public.can_access_restaurant(restaurant_id))
);

-- Generic audit trigger. Deliberately records metadata, not full payroll/personnel values.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb;
  rid uuid;
  eid text;
begin
  row_json := case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  begin
    rid := nullif(row_json ->> 'restaurant_id', '')::uuid;
  exception when others then
    rid := null;
  end;
  eid := coalesce(row_json ->> 'id', row_json ->> 'user_id', row_json ->> 'employee_id');

  insert into public.audit_log(actor_user_id, restaurant_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    rid,
    lower(TG_OP),
    TG_ARGV[0],
    eid,
    jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
  );

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.audit_row_change() from public;

-- Sensitive/operational tables automatically audited.
drop trigger if exists audit_rota_shifts on public.rota_shifts;
create trigger audit_rota_shifts after insert or update or delete on public.rota_shifts
for each row execute function public.audit_row_change('rota_shift');

drop trigger if exists audit_payroll_periods on public.payroll_periods;
create trigger audit_payroll_periods after insert or update or delete on public.payroll_periods
for each row execute function public.audit_row_change('payroll_period');

drop trigger if exists audit_payroll_adjustments on public.payroll_adjustments;
create trigger audit_payroll_adjustments after insert or update or delete on public.payroll_adjustments
for each row execute function public.audit_row_change('payroll_adjustment');

drop trigger if exists audit_pos_sales on public.pos_sales;
create trigger audit_pos_sales after insert or update or delete on public.pos_sales
for each row execute function public.audit_row_change('pos_sale');

drop trigger if exists audit_sales_daily on public.sales_daily;
create trigger audit_sales_daily after insert or update or delete on public.sales_daily
for each row execute function public.audit_row_change('sales_daily');

drop trigger if exists audit_employee_requests on public.employee_requests;
create trigger audit_employee_requests after insert or update or delete on public.employee_requests
for each row execute function public.audit_row_change('employee_request');

create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index if not exists audit_log_action_idx on public.audit_log(action, created_at desc);

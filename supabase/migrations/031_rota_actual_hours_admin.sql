-- Phase 6.5.1 — Rota Actual Hours Indicator + direct Admin/Super Admin correction

create or replace function public.set_actual_shift_time(
  p_shift_id uuid,
  p_actual_start_time time,
  p_actual_end_time time,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_shift public.rota_shifts%rowtype;
  v_closed boolean;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active = true;
  if v_role not in ('super_admin','admin') then raise exception 'Only Admin or Super Admin can edit actual hours directly'; end if;
  if p_actual_start_time is null or p_actual_end_time is null then raise exception 'Start and end time are required'; end if;
  if p_actual_start_time = p_actual_end_time then raise exception 'Start and end time cannot be equal'; end if;

  select * into v_shift from public.rota_shifts where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'Shift not found'; end if;
  if v_role = 'admin' and not exists (select 1 from public.user_restaurants ur where ur.user_id = auth.uid() and ur.restaurant_id = v_shift.restaurant_id) then
    raise exception 'Admin is not assigned to this restaurant';
  end if;

  select exists(select 1 from public.payroll_periods pp where pp.restaurant_id = v_shift.restaurant_id and pp.status = 'closed' and v_shift.shift_date between pp.period_start and pp.period_end) into v_closed;
  if v_closed then raise exception 'This payroll period is closed'; end if;

  update public.rota_shifts set
    actual_start_time = p_actual_start_time,
    actual_end_time = p_actual_end_time,
    actual_approved_at = now(),
    actual_approved_by = auth.uid(),
    updated_at = now()
  where id = p_shift_id;

  insert into public.audit_log(actor_user_id, restaurant_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_shift.restaurant_id, 'set_actual_shift_time', 'rota_shift', p_shift_id::text,
    jsonb_build_object('employee_id',v_shift.employee_id,'shift_date',v_shift.shift_date,'shift_slot',v_shift.shift_slot,'scheduled_start',v_shift.start_time,'scheduled_end',v_shift.end_time,'actual_start',p_actual_start_time,'actual_end',p_actual_end_time,'note',p_note));
end;
$$;

create or replace function public.clear_actual_shift_time(p_shift_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_shift public.rota_shifts%rowtype;
  v_closed boolean;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active = true;
  if v_role not in ('super_admin','admin') then raise exception 'Only Admin or Super Admin can clear actual hours'; end if;
  select * into v_shift from public.rota_shifts where id = p_shift_id for update;
  if v_shift.id is null then raise exception 'Shift not found'; end if;
  if v_role = 'admin' and not exists (select 1 from public.user_restaurants ur where ur.user_id = auth.uid() and ur.restaurant_id = v_shift.restaurant_id) then
    raise exception 'Admin is not assigned to this restaurant';
  end if;
  select exists(select 1 from public.payroll_periods pp where pp.restaurant_id=v_shift.restaurant_id and pp.status='closed' and v_shift.shift_date between pp.period_start and pp.period_end) into v_closed;
  if v_closed then raise exception 'This payroll period is closed'; end if;
  update public.rota_shifts set actual_start_time=null, actual_end_time=null, actual_approved_at=null, actual_approved_by=null, updated_at=now() where id=p_shift_id;
  insert into public.audit_log(actor_user_id,restaurant_id,action,entity_type,entity_id,details) values(auth.uid(),v_shift.restaurant_id,'clear_actual_shift_time','rota_shift',p_shift_id::text,jsonb_build_object('employee_id',v_shift.employee_id,'shift_date',v_shift.shift_date,'shift_slot',v_shift.shift_slot));
end;
$$;

revoke all on function public.set_actual_shift_time(uuid,time,time,text) from public;
grant execute on function public.set_actual_shift_time(uuid,time,time,text) to authenticated;
revoke all on function public.clear_actual_shift_time(uuid) from public;
grant execute on function public.clear_actual_shift_time(uuid) to authenticated;

-- Phase 6.5 — Employee Actual Hours & Approval Workflow

alter table public.employees
  add column if not exists can_edit_own_hours boolean not null default false,
  add column if not exists time_edit_requires_approval boolean not null default true;

alter table public.rota_shifts
  add column if not exists actual_start_time time,
  add column if not exists actual_end_time time,
  add column if not exists actual_approved_at timestamptz,
  add column if not exists actual_approved_by uuid references auth.users(id) on delete set null;

create table if not exists public.time_correction_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid not null references public.rota_shifts(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  shift_date date not null,
  scheduled_start_time time,
  scheduled_end_time time,
  proposed_start_time time not null,
  proposed_end_time time not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_correction_employee_date on public.time_correction_requests(employee_id, shift_date);
create index if not exists idx_time_correction_restaurant_status on public.time_correction_requests(restaurant_id, status, shift_date);
create unique index if not exists uq_time_correction_pending_shift
  on public.time_correction_requests(shift_id)
  where status = 'pending';

alter table public.time_correction_requests enable row level security;

drop policy if exists time_correction_own_select on public.time_correction_requests;
create policy time_correction_own_select on public.time_correction_requests
for select to authenticated
using (
  employee_id in (select id from public.employees where auth_user_id = auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'super_admin'
  )
  or exists (
    select 1 from public.profiles p
    join public.user_restaurants ur on ur.user_id = p.id
    where p.id = auth.uid() and p.is_active = true and p.role = 'admin' and ur.restaurant_id = time_correction_requests.restaurant_id
  )
);

drop policy if exists time_correction_own_cancel on public.time_correction_requests;

create or replace function public.submit_time_correction(
  p_shift_id uuid,
  p_proposed_start_time time,
  p_proposed_end_time time,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_shift public.rota_shifts%rowtype;
  v_request_id uuid;
  v_closed boolean;
begin
  select * into v_employee from public.employees where auth_user_id = auth.uid() and active = true;
  if v_employee.id is null then raise exception 'Employee account is not linked'; end if;
  if not coalesce(v_employee.can_edit_own_hours,false) then raise exception 'Time corrections are not enabled for this employee'; end if;

  select * into v_shift from public.rota_shifts where id = p_shift_id and employee_id = v_employee.id;
  if v_shift.id is null then raise exception 'Shift not found or not owned by employee'; end if;
  if p_proposed_start_time is null or p_proposed_end_time is null then raise exception 'Start and end time are required'; end if;
  if p_proposed_start_time = p_proposed_end_time then raise exception 'Start and end time cannot be equal'; end if;

  select exists(
    select 1 from public.payroll_periods pp
    where pp.restaurant_id = v_shift.restaurant_id
      and pp.status = 'closed'
      and v_shift.shift_date between pp.period_start and pp.period_end
  ) into v_closed;
  if v_closed then raise exception 'This payroll period is closed'; end if;

  if not coalesce(v_employee.time_edit_requires_approval,true) then
    update public.rota_shifts
      set actual_start_time = p_proposed_start_time,
          actual_end_time = p_proposed_end_time,
          actual_approved_at = now(),
          actual_approved_by = auth.uid(),
          updated_at = now()
      where id = v_shift.id;

    insert into public.time_correction_requests(
      employee_id,shift_id,restaurant_id,shift_date,scheduled_start_time,scheduled_end_time,
      proposed_start_time,proposed_end_time,reason,status,reviewed_by,reviewed_at,review_note
    ) values (
      v_employee.id,v_shift.id,v_shift.restaurant_id,v_shift.shift_date,v_shift.start_time,v_shift.end_time,
      p_proposed_start_time,p_proposed_end_time,p_reason,'approved',auth.uid(),now(),'Auto-approved by employee permission'
    ) returning id into v_request_id;
  else
    insert into public.time_correction_requests(
      employee_id,shift_id,restaurant_id,shift_date,scheduled_start_time,scheduled_end_time,
      proposed_start_time,proposed_end_time,reason,status
    ) values (
      v_employee.id,v_shift.id,v_shift.restaurant_id,v_shift.shift_date,v_shift.start_time,v_shift.end_time,
      p_proposed_start_time,p_proposed_end_time,p_reason,'pending'
    ) returning id into v_request_id;
  end if;

  insert into public.audit_log(actor_user_id, restaurant_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_shift.restaurant_id, 'submit_time_correction', 'time_correction_request', v_request_id::text,
    jsonb_build_object('shift_id', v_shift.id, 'employee_id', v_employee.id, 'proposed_start', p_proposed_start_time, 'proposed_end', p_proposed_end_time));

  return v_request_id;
end;
$$;

create or replace function public.cancel_time_correction(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
begin
  select id into v_employee_id from public.employees where auth_user_id = auth.uid() and active = true;
  if v_employee_id is null then raise exception 'Employee account is not linked'; end if;

  update public.time_correction_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id and employee_id = v_employee_id and status = 'pending';
  if not found then raise exception 'Pending correction request not found'; end if;
end;
$$;

create or replace function public.review_time_correction(
  p_request_id uuid,
  p_status text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_req public.time_correction_requests%rowtype;
  v_closed boolean;
begin
  select role into v_role from public.profiles where id = auth.uid() and is_active = true;
  if v_role not in ('super_admin','admin') then raise exception 'Not authorized to review time corrections'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;


  select * into v_req from public.time_correction_requests where id = p_request_id and status = 'pending' for update;
  if v_req.id is null then raise exception 'Pending correction request not found'; end if;
  if v_role = 'admin' and not exists (
    select 1 from public.user_restaurants ur where ur.user_id = auth.uid() and ur.restaurant_id = v_req.restaurant_id
  ) then raise exception 'Admin is not assigned to this restaurant'; end if;

  select exists(
    select 1 from public.payroll_periods pp
    where pp.restaurant_id = v_req.restaurant_id
      and pp.status = 'closed'
      and v_req.shift_date between pp.period_start and pp.period_end
  ) into v_closed;
  if v_closed then raise exception 'This payroll period is closed'; end if;

  update public.time_correction_requests
    set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note, updated_at = now()
    where id = p_request_id;

  if p_status = 'approved' then
    update public.rota_shifts
      set actual_start_time = v_req.proposed_start_time,
          actual_end_time = v_req.proposed_end_time,
          actual_approved_at = now(),
          actual_approved_by = auth.uid(),
          updated_at = now()
      where id = v_req.shift_id;
  end if;

  insert into public.audit_log(actor_user_id, restaurant_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_req.restaurant_id, 'review_time_correction', 'time_correction_request', v_req.id::text,
    jsonb_build_object('status', p_status, 'shift_id', v_req.shift_id, 'employee_id', v_req.employee_id, 'review_note', p_review_note));
end;
$$;

revoke all on function public.submit_time_correction(uuid,time,time,text) from public;
grant execute on function public.submit_time_correction(uuid,time,time,text) to authenticated;
revoke all on function public.cancel_time_correction(uuid) from public;
grant execute on function public.cancel_time_correction(uuid) to authenticated;
revoke all on function public.review_time_correction(uuid,text,text) from public;
grant execute on function public.review_time_correction(uuid,text,text) to authenticated;

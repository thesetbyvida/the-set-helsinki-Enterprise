-- The Set Helsinki Enterprise 5.4 — Employee Portal Final
-- Run after 023_security_audit.sql.
-- Adds restaurant-aware requests and safe vacation/VV application to the rota.

alter table public.employee_requests
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null,
  add column if not exists applied_to_rota boolean not null default false,
  add column if not exists applied_at timestamptz,
  add column if not exists applied_by uuid references auth.users(id) on delete set null;

create index if not exists idx_employee_requests_restaurant_status
  on public.employee_requests(restaurant_id, status, created_at desc);

-- Backfill the restaurant only where an employee has exactly one restaurant assignment.
update public.employee_requests erq
set restaurant_id = x.restaurant_id
from (
  select employee_id, min(restaurant_id) as restaurant_id
  from public.employee_restaurants
  group by employee_id
  having count(*) = 1
) x
where erq.restaurant_id is null
  and erq.employee_id = x.employee_id;

-- Review helper now optionally applies approved Vacation/VV requests to an existing rota.
-- Safety rules:
--   * only admins can review/apply;
--   * only vacation and vv are auto-applied;
--   * an existing worked shift is never overwritten;
--   * the rota period must already exist for every requested date;
--   * closed payroll dates remain protected by the existing rota RLS/lock rules.
create or replace function public.review_employee_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null,
  p_apply_to_rota boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.employee_requests%rowtype;
  d date;
  period_uuid uuid;
  existing_shift public.rota_shifts%rowtype;
  target_code text;
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'Invalid request status';
  end if;

  select * into req
  from public.employee_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if req.status <> 'pending' then
    raise exception 'Only pending requests can be reviewed';
  end if;

  if p_apply_to_rota and p_status <> 'approved' then
    raise exception 'Only approved requests can be applied to the rota';
  end if;

  if p_apply_to_rota then
    if req.request_type not in ('vacation','vv') then
      raise exception 'Automatic rota application is available only for Vacation and VV requests';
    end if;
    if req.restaurant_id is null then
      raise exception 'Select a restaurant for this request before applying it to the rota';
    end if;
    if req.start_date is null then
      raise exception 'Request has no start date';
    end if;

    target_code := case when req.request_type = 'vacation' then 'vl' else 'vv' end;

    for d in
      select generate_series(req.start_date, coalesce(req.end_date, req.start_date), interval '1 day')::date
    loop
      select rp.id into period_uuid
      from public.rota_periods rp
      where rp.restaurant_id = req.restaurant_id
        and d between rp.start_date and rp.end_date
      order by rp.start_date desc
      limit 1;

      if period_uuid is null then
        raise exception 'No rota period exists for %', d;
      end if;

      select * into existing_shift
      from public.rota_shifts rs
      where rs.period_id = period_uuid
        and rs.employee_id = req.employee_id
        and rs.shift_date = d
        and rs.shift_slot = 1
      limit 1;

      if found then
        if existing_shift.start_time is not null
           or existing_shift.end_time is not null
           or coalesce(trim(existing_shift.code), '') not in ('', target_code) then
          raise exception 'Rota conflict on %: an existing shift/code would be overwritten', d;
        end if;

        update public.rota_shifts
        set start_time = null,
            end_time = null,
            code = target_code,
            note = case
              when coalesce(trim(note), '') = '' then 'Approved employee request'
              else note
            end,
            updated_at = now()
        where id = existing_shift.id;
      else
        insert into public.rota_shifts(
          period_id, restaurant_id, employee_id, shift_date, shift_slot,
          start_time, end_time, code, note
        ) values (
          period_uuid, req.restaurant_id, req.employee_id, d, 1,
          null, null, target_code, 'Approved employee request'
        );
      end if;
    end loop;
  end if;

  update public.employee_requests
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      applied_to_rota = case when p_apply_to_rota and p_status = 'approved' then true else applied_to_rota end,
      applied_at = case when p_apply_to_rota and p_status = 'approved' then now() else applied_at end,
      applied_by = case when p_apply_to_rota and p_status = 'approved' then auth.uid() else applied_by end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.review_employee_request(uuid,text,text,boolean) from public;
grant execute on function public.review_employee_request(uuid,text,text,boolean) to authenticated;

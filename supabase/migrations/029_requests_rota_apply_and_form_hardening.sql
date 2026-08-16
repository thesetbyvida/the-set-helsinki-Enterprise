-- The Set Helsinki Enterprise 6.4.2 — Requests → Rota finalization
-- Safe, idempotent completion of employee_requests and Approve + Rota.
-- Run after 028_employee_access_lockdown.sql.

alter table public.employee_requests
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null,
  add column if not exists applied_to_rota boolean not null default false,
  add column if not exists applied_at timestamptz,
  add column if not exists applied_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists idx_employee_requests_restaurant_status
  on public.employee_requests(restaurant_id, status, created_at desc);
create index if not exists idx_employee_requests_applied_to_rota
  on public.employee_requests(applied_to_rota);

-- Backfill restaurant only when the employee has one unambiguous assignment.
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

-- Remove historical overloads so PostgREST resolves one canonical RPC.
drop function if exists public.review_employee_request(uuid,text);
drop function if exists public.review_employee_request(uuid,text,text);
drop function if exists public.review_employee_request(uuid,text,text,boolean);
drop function if exists public.review_employee_request(text,boolean,uuid,text);

create function public.review_employee_request(
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

  -- Non-super admins are restricted to restaurants assigned to them.
  if req.restaurant_id is not null and not public.can_access_restaurant(req.restaurant_id) then
    raise exception 'You do not have access to this restaurant';
  end if;

  if p_apply_to_rota and p_status <> 'approved' then
    raise exception 'Only approved requests can be applied to the rota';
  end if;

  if p_apply_to_rota then
    if req.request_type not in ('vacation','vv') then
      raise exception 'Approve + Rota is available only for Vacation and VV requests';
    end if;
    if req.restaurant_id is null then
      raise exception 'Select a restaurant for this request before applying it to the rota';
    end if;
    if req.start_date is null then
      raise exception 'Request has no start date';
    end if;

    target_code := case when req.request_type = 'vacation' then 'vl' else 'vv' end;

    -- Validate the complete range first. Nothing is written until every date is safe.
    for d in
      select generate_series(req.start_date, coalesce(req.end_date, req.start_date), interval '1 day')::date
    loop
      period_uuid := null;
      select rp.id into period_uuid
      from public.rota_periods rp
      where rp.restaurant_id = req.restaurant_id
        and d between rp.start_date and rp.end_date
      order by rp.start_date desc
      limit 1;

      if period_uuid is null then
        raise exception 'No 3-week rota period exists for %', d;
      end if;

      select * into existing_shift
      from public.rota_shifts rs
      where rs.period_id = period_uuid
        and rs.employee_id = req.employee_id
        and rs.shift_date = d
        and rs.shift_slot = 1
      limit 1;

      if found and (
        existing_shift.start_time is not null
        or existing_shift.end_time is not null
        or coalesce(trim(existing_shift.code), '') not in ('', target_code)
      ) then
        raise exception 'Rota conflict on %: an existing shift or different code would be overwritten', d;
      end if;

      -- A split shift in slot 2–4 is also a conflict. Never hide/remove real work.
      if exists (
        select 1 from public.rota_shifts rs
        where rs.period_id = period_uuid
          and rs.employee_id = req.employee_id
          and rs.shift_date = d
          and rs.shift_slot between 2 and 4
          and (
            rs.start_time is not null
            or rs.end_time is not null
            or coalesce(trim(rs.code), '') <> ''
          )
      ) then
        raise exception 'Rota conflict on %: another shift slot already contains work/code', d;
      end if;
    end loop;

    -- Validation passed: apply VL/VV to slot 1 for every requested date.
    for d in
      select generate_series(req.start_date, coalesce(req.end_date, req.start_date), interval '1 day')::date
    loop
      select rp.id into period_uuid
      from public.rota_periods rp
      where rp.restaurant_id = req.restaurant_id
        and d between rp.start_date and rp.end_date
      order by rp.start_date desc
      limit 1;

      insert into public.rota_shifts(
        period_id, restaurant_id, employee_id, shift_date, shift_slot,
        start_time, end_time, code, note
      ) values (
        period_uuid, req.restaurant_id, req.employee_id, d, 1,
        null, null, target_code, 'Approved employee request'
      )
      on conflict (period_id, employee_id, shift_date, shift_slot)
      do update set
        start_time = null,
        end_time = null,
        code = excluded.code,
        note = case
          when coalesce(trim(rota_shifts.note), '') = '' then excluded.note
          else rota_shifts.note
        end,
        updated_at = now();
    end loop;
  end if;

  update public.employee_requests
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      review_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      applied_to_rota = case
        when p_apply_to_rota and p_status = 'approved' then true
        else false
      end,
      applied_at = case
        when p_apply_to_rota and p_status = 'approved' then now()
        else null
      end,
      applied_by = case
        when p_apply_to_rota and p_status = 'approved' then auth.uid()
        else null
      end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.review_employee_request(uuid,text,text,boolean) from public;
grant execute on function public.review_employee_request(uuid,text,text,boolean) to authenticated;

-- Ask PostgREST to refresh its schema cache immediately after migration.
notify pgrst, 'reload schema';

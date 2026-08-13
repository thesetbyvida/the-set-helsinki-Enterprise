-- The Set Helsinki Enterprise 4.8 — Employee self-service & request workflow
-- Run after 013_vacations_requests.sql and 021_rota_multi_shift.sql.

-- Expand request workflow without deleting existing requests.
alter table public.employee_requests
  drop constraint if exists employee_requests_request_type_check;

alter table public.employee_requests
  add constraint employee_requests_request_type_check
  check (request_type in ('vacation','vv','shift_change','availability','other'));

alter table public.employee_requests
  add column if not exists requested_start_time time,
  add column if not exists requested_end_time time,
  add column if not exists admin_note text;

create index if not exists idx_employee_requests_status_created
  on public.employee_requests(status, created_at desc);

-- Approval/rejection helper. Keeps reviewer metadata and optional admin note together.
create or replace function public.review_employee_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'Invalid request status';
  end if;

  update public.employee_requests
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  if not found then
    raise exception 'Request not found';
  end if;
end;
$$;

revoke all on function public.review_employee_request(uuid,text,text) from public;
grant execute on function public.review_employee_request(uuid,text,text) to authenticated;

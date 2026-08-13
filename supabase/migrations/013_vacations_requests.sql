-- Enterprise 3.7 Vacations + Requests

alter table public.employee_requests
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_employee_requests_employee_status
  on public.employee_requests(employee_id, status);

create index if not exists idx_employee_requests_dates
  on public.employee_requests(start_date, end_date);

-- Recreate policies so employees can cancel their own pending requests
-- while admins can approve/reject any request.
drop policy if exists "employee_requests_select_own_or_admin" on public.employee_requests;
create policy "employee_requests_select_own_or_admin"
on public.employee_requests
for select
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.employees e
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
    select 1
    from public.employees e
    where e.id = employee_requests.employee_id
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
);

drop policy if exists "employee_requests_update_admin" on public.employee_requests;
drop policy if exists "employee_requests_update_own_pending" on public.employee_requests;

create policy "employee_requests_update_admin"
on public.employee_requests
for update
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "employee_requests_update_own_pending"
on public.employee_requests
for update
using (
  status = 'pending'
  and exists (
    select 1
    from public.employees e
    where e.id = employee_requests.employee_id
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
)
with check (
  status in ('pending','cancelled')
  and exists (
    select 1
    from public.employees e
    where e.id = employee_requests.employee_id
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
);

-- Helper RPC for admins. Keeps approval metadata consistent.
create or replace function public.review_employee_request(
  p_request_id uuid,
  p_status text
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
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.review_employee_request(uuid,text) from public;
grant execute on function public.review_employee_request(uuid,text) to authenticated;

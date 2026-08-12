-- Enterprise 3.2: atomic per-restaurant employee ordering
-- Run once in Supabase SQL Editor.

create or replace function public.set_restaurant_employee_order(
  p_restaurant_id uuid,
  p_employee_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_expected integer;
  v_received integer;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('super_admin', 'admin')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only active admin or super_admin users can change employee order';
  end if;

  if p_restaurant_id is null then
    raise exception 'restaurant_id is required';
  end if;

  if p_employee_ids is null or coalesce(array_length(p_employee_ids, 1), 0) = 0 then
    raise exception 'employee_ids cannot be empty';
  end if;

  -- Reject duplicate employee ids in the submitted order.
  select count(*), count(distinct x)
  into v_received, v_expected
  from unnest(p_employee_ids) as x;

  if v_received <> v_expected then
    raise exception 'employee_ids contains duplicates';
  end if;

  -- Ensure every submitted employee is actually assigned to this restaurant.
  select count(*) into v_expected
  from public.employee_restaurants er
  where er.restaurant_id = p_restaurant_id
    and er.employee_id = any(p_employee_ids);

  if v_expected <> v_received then
    raise exception 'One or more employees are not assigned to this restaurant';
  end if;

  update public.employee_restaurants er
  set display_order = ordered.ordinality::integer
  from unnest(p_employee_ids) with ordinality as ordered(employee_id, ordinality)
  where er.restaurant_id = p_restaurant_id
    and er.employee_id = ordered.employee_id;
end;
$$;

revoke all on function public.set_restaurant_employee_order(uuid, uuid[]) from public;
grant execute on function public.set_restaurant_employee_order(uuid, uuid[]) to authenticated;

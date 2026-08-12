-- Enterprise 3.1.3: persistent employee ordering per restaurant

alter table public.employee_restaurants
  add column if not exists display_order integer not null default 999;

alter table public.employee_restaurants enable row level security;

drop policy if exists employee_restaurants_select_authenticated on public.employee_restaurants;
create policy employee_restaurants_select_authenticated
on public.employee_restaurants for select
to authenticated
using (true);

drop policy if exists employee_restaurants_write_admin on public.employee_restaurants;
create policy employee_restaurants_write_admin
on public.employee_restaurants for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
      and profiles.role in ('super_admin','admin')
  )
);

-- Normalize duplicate/empty order values by assigning a deterministic order.
with ranked as (
  select employee_id, restaurant_id,
         row_number() over (partition by restaurant_id order by display_order, employee_id) as rn
  from public.employee_restaurants
)
update public.employee_restaurants er
set display_order = ranked.rn
from ranked
where er.employee_id = ranked.employee_id
  and er.restaurant_id = ranked.restaurant_id;

-- The Set Helsinki Enterprise 4.0 Production
-- Final production hardening foundation.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid default auth.uid(),
  restaurant_id uuid references public.restaurants(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id);
create index if not exists audit_log_restaurant_idx on public.audit_log(restaurant_id);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_admin_select on public.audit_log;
drop policy if exists audit_log_authenticated_insert on public.audit_log;

create policy audit_log_admin_select
on public.audit_log
for select
to authenticated
using (public.is_app_admin());

create policy audit_log_authenticated_insert
on public.audit_log
for insert
to authenticated
with check (actor_user_id = auth.uid());

-- Keep updated_at consistent on requests and sales.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employee_requests_updated_at on public.employee_requests;
create trigger trg_employee_requests_updated_at
before update on public.employee_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_daily_updated_at on public.sales_daily;
create trigger trg_sales_daily_updated_at
before update on public.sales_daily
for each row execute function public.set_updated_at();

-- Security hygiene: only authenticated users may access app-facing tables.
revoke all on table public.audit_log from anon;
grant select, insert on table public.audit_log to authenticated;

-- Helpful indexes for production queries.
create index if not exists rota_shifts_restaurant_date_idx
  on public.rota_shifts(restaurant_id, shift_date);

create index if not exists employee_restaurants_restaurant_order_idx
  on public.employee_restaurants(restaurant_id, display_order);

create index if not exists profiles_role_active_idx
  on public.profiles(role, is_active);

create index if not exists employees_active_idx
  on public.employees(active);

-- Optional operational view for admins.
create or replace view public.production_health as
select
  (select count(*) from public.profiles where is_active = true) as active_profiles,
  (select count(*) from public.employees where active = true) as active_employees,
  (select count(*) from public.restaurants where active = true) as active_restaurants,
  (select count(*) from public.employee_requests where status = 'pending') as pending_requests,
  now() as checked_at;

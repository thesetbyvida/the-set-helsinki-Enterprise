-- The Set Helsinki Enterprise 2.0 — Phase 5: 3-week rota

create table if not exists public.rota_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rota_period_dates check (end_date = start_date + 20),
  constraint rota_period_unique unique (restaurant_id, start_date)
);

create table if not exists public.rota_shifts (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.rota_periods(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  code text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rota_shift_unique unique (period_id, employee_id, shift_date),
  constraint rota_shift_code check (lower(code) in ('','s','vl','vv','v','vp'))
);

create index if not exists rota_periods_restaurant_start_idx
  on public.rota_periods(restaurant_id, start_date desc);
create index if not exists rota_shifts_period_idx on public.rota_shifts(period_id);
create index if not exists rota_shifts_employee_date_idx on public.rota_shifts(employee_id, shift_date);

alter table public.rota_periods enable row level security;
alter table public.rota_shifts enable row level security;

-- Helpers reuse profiles/user_restaurants from phases 1–4.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.can_access_restaurant(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'super_admin'
        or exists (
          select 1 from public.user_restaurants ur
          where ur.user_id = auth.uid() and ur.restaurant_id = target_restaurant
        )
      )
  );
$$;

create or replace function public.can_edit_rota(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_restaurant(target_restaurant)
    and coalesce(public.current_app_role(), '') in ('super_admin','admin','manager');
$$;

drop policy if exists "rota periods read" on public.rota_periods;
create policy "rota periods read" on public.rota_periods
for select to authenticated
using (public.can_access_restaurant(restaurant_id));

drop policy if exists "rota periods insert" on public.rota_periods;
create policy "rota periods insert" on public.rota_periods
for insert to authenticated
with check (public.can_edit_rota(restaurant_id));

drop policy if exists "rota periods update" on public.rota_periods;
create policy "rota periods update" on public.rota_periods
for update to authenticated
using (public.can_edit_rota(restaurant_id))
with check (public.can_edit_rota(restaurant_id));

drop policy if exists "rota periods delete" on public.rota_periods;
create policy "rota periods delete" on public.rota_periods
for delete to authenticated
using (public.can_edit_rota(restaurant_id));

drop policy if exists "rota shifts read" on public.rota_shifts;
create policy "rota shifts read" on public.rota_shifts
for select to authenticated
using (public.can_access_restaurant(restaurant_id));

drop policy if exists "rota shifts insert" on public.rota_shifts;
create policy "rota shifts insert" on public.rota_shifts
for insert to authenticated
with check (public.can_edit_rota(restaurant_id));

drop policy if exists "rota shifts update" on public.rota_shifts;
create policy "rota shifts update" on public.rota_shifts
for update to authenticated
using (public.can_edit_rota(restaurant_id))
with check (public.can_edit_rota(restaurant_id));

drop policy if exists "rota shifts delete" on public.rota_shifts;
create policy "rota shifts delete" on public.rota_shifts
for delete to authenticated
using (public.can_edit_rota(restaurant_id));

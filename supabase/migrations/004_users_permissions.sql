-- The Set Helsinki Enterprise 2.0 — Phase 4 Users & Permissions
-- Run after 001_foundation.sql, 002_restaurants.sql and 003_employees.sql.

-- Helper functions are SECURITY DEFINER so authorization checks do not recurse
-- through the profiles RLS policies.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('super_admin','admin'), false);
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_restaurants enable row level security;

-- Replace the permissive Phase 1 policies with explicit user/admin access.
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_app_admin());

create policy profiles_update_admin
on public.profiles for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- user_restaurants: users can read their own assignments; admins can read/write all.
drop policy if exists user_restaurants_select_authenticated on public.user_restaurants;
drop policy if exists user_restaurants_select_self_or_admin on public.user_restaurants;
drop policy if exists user_restaurants_write_admin on public.user_restaurants;

create policy user_restaurants_select_self_or_admin
on public.user_restaurants for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

create policy user_restaurants_write_admin
on public.user_restaurants for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- Optional indexes for the Users page.
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(is_active);
create index if not exists user_restaurants_user_idx on public.user_restaurants(user_id);
create index if not exists user_restaurants_restaurant_idx on public.user_restaurants(restaurant_id);

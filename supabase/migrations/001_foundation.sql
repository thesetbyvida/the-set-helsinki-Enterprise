-- The Set Helsinki Enterprise 2.0 — Phase 1
-- Same Supabase project: yiumnpzvbfkwgnfcrots

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'employee'
    check(role in ('super_admin','admin','manager','employee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (true);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

insert into public.profiles(id,email,full_name,role,is_active)
select id,email,'Victor','super_admin',true
from auth.users
where email='vida_paredes@hotmail.com'
on conflict(id) do update
set email=excluded.email,
    full_name='Victor',
    role='super_admin',
    is_active=true;

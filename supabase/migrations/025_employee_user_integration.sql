-- The Set Helsinki Enterprise 6.2.1
-- Stable link between an employee record and its Supabase Auth user.
alter table public.employees
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_auth_user_id_uidx
  on public.employees(auth_user_id)
  where auth_user_id is not null;

create index if not exists employees_email_lower_idx
  on public.employees(lower(email))
  where email is not null;

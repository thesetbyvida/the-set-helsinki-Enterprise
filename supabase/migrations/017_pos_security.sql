-- The Set Helsinki Enterprise 4.1 — POS / Sales security and duplicate protection

alter table public.pos_import_jobs enable row level security;
alter table public.pos_sales enable row level security;

revoke all on table public.pos_import_jobs from anon;
revoke all on table public.pos_sales from anon;
grant select, insert, update, delete on table public.pos_import_jobs to authenticated;
grant select, insert, update, delete on table public.pos_sales to authenticated;

drop policy if exists pos_import_jobs_admin_all on public.pos_import_jobs;
create policy pos_import_jobs_admin_all on public.pos_import_jobs
for all to authenticated
using (public.current_user_role() in ('super_admin','admin','manager'))
with check (public.current_user_role() in ('super_admin','admin','manager'));

drop policy if exists pos_sales_staff_select on public.pos_sales;
create policy pos_sales_staff_select on public.pos_sales
for select to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1 from public.user_restaurants ur
    where ur.user_id = auth.uid() and ur.restaurant_id = pos_sales.restaurant_id
  )
);

drop policy if exists pos_sales_staff_write on public.pos_sales;
create policy pos_sales_staff_write on public.pos_sales
for all to authenticated
using (
  public.is_app_admin()
  or (
    public.current_user_role() = 'manager'
    and exists (
      select 1 from public.user_restaurants ur
      where ur.user_id = auth.uid() and ur.restaurant_id = pos_sales.restaurant_id
    )
  )
)
with check (
  public.is_app_admin()
  or (
    public.current_user_role() = 'manager'
    and exists (
      select 1 from public.user_restaurants ur
      where ur.user_id = auth.uid() and ur.restaurant_id = pos_sales.restaurant_id
    )
  )
);

create unique index if not exists pos_sales_receipt_unique
on public.pos_sales(restaurant_id, business_date, receipt_no)
where receipt_no is not null;

create index if not exists pos_sales_restaurant_date_idx
on public.pos_sales(restaurant_id, business_date desc);

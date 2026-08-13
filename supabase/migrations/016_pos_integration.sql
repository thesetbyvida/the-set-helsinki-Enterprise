-- 016_pos_integration.sql
create table if not exists public.pos_import_jobs(
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid references public.restaurants(id),
 source text not null,
 status text not null default 'pending',
 imported_rows integer default 0,
 created_at timestamptz default now()
);

create table if not exists public.pos_sales(
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid references public.restaurants(id),
 business_date date not null,
 receipt_no text,
 gross_amount numeric(12,2) default 0,
 net_amount numeric(12,2) default 0,
 source text,
 created_at timestamptz default now()
);

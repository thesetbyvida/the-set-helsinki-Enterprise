-- The Set Helsinki Enterprise 4.2 — POS CSV import

alter table public.pos_import_jobs add column if not exists file_name text;
alter table public.pos_import_jobs add column if not exists skipped_rows integer not null default 0;
alter table public.pos_import_jobs add column if not exists failed_rows integer not null default 0;
alter table public.pos_import_jobs add column if not exists completed_at timestamptz;

create or replace function public.import_pos_sales_batch(
  p_restaurant_id uuid,
  p_source text,
  p_rows jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_input integer := 0;
  v_inserted integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  select jsonb_array_length(p_rows) into v_input;

  with incoming as (
    select
      nullif(x->>'business_date','')::date as business_date,
      nullif(trim(x->>'receipt_no'),'') as receipt_no,
      coalesce(nullif(x->>'gross_amount','')::numeric,0) as gross_amount,
      coalesce(nullif(x->>'net_amount','')::numeric,0) as net_amount,
      coalesce(nullif(trim(x->>'source'),''), nullif(trim(p_source),''), 'csv') as source
    from jsonb_array_elements(p_rows) x
  ), ins as (
    insert into public.pos_sales(restaurant_id,business_date,receipt_no,gross_amount,net_amount,source)
    select p_restaurant_id,business_date,receipt_no,gross_amount,net_amount,source
    from incoming
    where business_date is not null
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  return jsonb_build_object(
    'imported', v_inserted,
    'skipped', greatest(v_input - v_inserted, 0),
    'failed', 0
  );
end;
$$;

grant execute on function public.import_pos_sales_batch(uuid,text,jsonb) to authenticated;

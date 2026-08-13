-- The Set Helsinki Enterprise 4.7
-- Multiple shifts for the same employee on the same day.
-- Existing rows remain Shift 1. New rows may use Shift 2, 3 or 4.

alter table public.rota_shifts
  add column if not exists shift_slot smallint not null default 1;

alter table public.rota_shifts
  drop constraint if exists rota_shift_unique;

alter table public.rota_shifts
  drop constraint if exists rota_shift_slot_check;

alter table public.rota_shifts
  add constraint rota_shift_slot_check check (shift_slot between 1 and 4);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rota_shift_slot_unique'
      and conrelid = 'public.rota_shifts'::regclass
  ) then
    alter table public.rota_shifts
      add constraint rota_shift_slot_unique
      unique (period_id, employee_id, shift_date, shift_slot);
  end if;
end $$;

create index if not exists rota_shifts_employee_date_slot_idx
  on public.rota_shifts(employee_id, shift_date, shift_slot);

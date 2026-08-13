# The Set Helsinki Enterprise 4.7 — Rota Final

## Main changes

- Multiple shifts for the same employee on the same day (up to 4).
- `+ Shift / + Turno / + Vuoro` inside each rota day.
- Independent Start, End, Code and Note for every shift.
- Daily and weekly totals sum all shifts correctly.
- Payroll and HourCalc receive every rota row, so split shifts are counted separately.
- Existing employee drag & drop/order persistence remains enabled.
- Sticky day headers, employee column and weekly total column remain enabled.
- Print layout prints every shift in the day and the combined daily total.

## Required Supabase migration

Run this file in Supabase SQL Editor before using multiple shifts:

`supabase/migrations/021_rota_multi_shift.sql`

Existing shifts are preserved automatically as `shift_slot = 1`.

## Deploy

1. Run migration 021 in Supabase.
2. Upload this version to the same GitHub repository.
3. Vercel should build version `4.7.0`.
4. Test one employee with two shifts on one date, for example 10:00–14:00 and 18:00–23:30.
5. Verify Rota, HourCalc and Payroll totals.

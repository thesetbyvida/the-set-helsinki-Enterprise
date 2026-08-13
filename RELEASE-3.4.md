# The Set Helsinki Enterprise 3.4 — VV / Hour Bank / Overtime Base

## Included
- Real VV / Vuosivapaa page (the Phase 8 placeholder is removed).
- Company-rule defaults: 200 worked hours = 1 VV, maximum 9 per calendar year; configurable per restaurant.
- VV earned, used, manual adjustment, balance, progress to next VV, and hour-bank balance per employee.
- Admin manual corrections with an auditable `vv_adjustments` table.
- New database base for future 3-week overtime snapshots (`overtime_periods`).
- Existing Rota 3.3 order/print behavior is preserved.

## Required database step
Run once in Supabase SQL Editor, after migrations 001–009:

`supabase/migrations/010_vv_hour_bank_overtime.sql`

## Important
The 200-hour / 9-VV values are configured as the company's requested defaults. Confirm the applicable current collective-agreement rules before treating the output as authoritative payroll/legal calculation.

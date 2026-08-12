# The Set Helsinki Enterprise 2.0 — Phase 7

Phase 7 adds the production payroll view on top of Phases 1–6.

## New in Phase 7

- Payroll selector with previous/future periods; default company cycle is **21st–20th**.
- Restaurant selector for admins/managers.
- Per-employee breakdown: base, evening, night, Sunday, holiday, non-duplicated 100%, aatto, S, VL and VV.
- Money calculation for hourly employees and monthly-salary base support.
- Sunday/holiday **100% premium** uses each employee's hourly rate and does not double-pay an hour that is both Sunday and holiday.
- Evening/night/aatto euro supplements are configurable per restaurant in `payroll_settings` instead of being hard-coded.
- Printable landscape payroll with totals.
- Existing TES engine rules from Phase 6 are reused, including overnight shifts and S/VL/VV codes.

## Supabase migration

Run these migrations in order if the database is new. For an existing Phase 6 database, only run:

`supabase/migrations/007_payroll.sql`

The same migration is also copied to the project root as `007_payroll.sql`.

### Important

The migration intentionally starts evening/night/aatto rates at **€0.00**. After deploying, open Payroll as Admin/Super Admin and enter the official current TES euro rates used by the company. This avoids embedding outdated collective-agreement rates in application code.

## Build

```bash
npm install
npm run build
```

## Next phase

Phase 8: VV / vuosivapaa + 112.5 h overtime / hour-bank tracking.

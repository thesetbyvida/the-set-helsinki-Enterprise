# The Set Helsinki Enterprise 4.0 — Production

This release consolidates the 3.x line for production deployment.

## Included
- Multi-restaurant administration
- Employees and users
- 3-week Rota
- HourCalc / TES breakdown
- Payroll PRO
- VV / Hour Bank / Overtime foundation
- Employee App
- Vacations & requests
- Dashboard PRO
- Reports / CSV / Excel / PDF print
- Audit log foundation
- Production database indexes and update triggers
- Production health view
- Deployment and backup checklist

## Supabase
Run once:

`supabase/migrations/015_production_hardening.sql`

## Important
4.0 is a production hardening release, not a promise that payroll/legal settings are universally correct.
Verify the current TES values and your payroll/accounting requirements before using calculated monetary values as final payroll.

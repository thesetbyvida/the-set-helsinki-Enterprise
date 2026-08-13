# The Set Helsinki Enterprise 5.5

## Reports & Accounting Final

- Closed payroll periods are read from their stored historical snapshot instead of recalculating from current employee/rota data.
- Added Payroll history selector with OPEN/CLOSED status.
- Reports clearly identify live calculations versus locked historical snapshots.
- CSV exports now include report metadata and a totals row.
- Excel-compatible export includes period status and report totals.
- Existing Payroll, Rota, Employee Portal, POS and Supabase data are unchanged.

No new SQL migration is required. Requires the existing payroll_periods table from migration 020.

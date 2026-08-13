# The Set Helsinki Enterprise 4.5

## Payroll History & Closed Periods

Phase 4.5 builds on 4.4 and adds a production-safe payroll history workflow.

### New
- Payroll period history selector with 24 past and 12 future periods.
- Closed periods are marked with a lock icon.
- Admin / Super Admin can close a payroll period.
- Closing stores a JSON snapshot of all payroll rows, totals and payroll settings.
- Historical closed payrolls do not change when employee salaries or TES settings are edited later.
- Closed payroll dates are locked at database level for rota shifts and payroll adjustments.
- Admin / Super Admin can reopen a period when a correction is required.
- CSV export from Payroll exports the exact live or historical data currently shown.
- Print/PDF includes OPEN/CLOSED status.
- Production checks now include the `payroll_periods` table.

## Required Supabase migration
Run this first in Supabase SQL Editor:

`supabase/migrations/020_payroll_history_lock.sql`

Then upload the 4.5 project to the same GitHub repository. Vercel should deploy automatically.

## Important workflow
1. Finish the rota and payroll adjustments for the 21–20 period.
2. Review Payroll.
3. Export/print if required.
4. Click **Close period**.
5. The payroll snapshot is stored and rota/payroll changes for those dates are locked.
6. If a correction is needed, an Admin can **Reopen period**, edit, review, and close it again to save a new snapshot.

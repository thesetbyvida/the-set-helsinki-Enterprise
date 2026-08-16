# The Set Helsinki Enterprise 6.5.1

## Rota Actual Hours Indicator

- Keeps the published/scheduled rota unchanged.
- Shows approved actual start/end times beside the scheduled shift.
- Admin and Super Admin can directly edit actual hours from the Rota.
- Direct edits are written to Audit Log.
- HourCalc and Payroll continue using approved actual hours.
- Closed payroll periods block actual-hour changes.
- Printing can include or hide actual hours with the “Print actual hours” checkbox.

## Install

Run `supabase/migrations/031_rota_actual_hours_admin.sql` in Supabase SQL Editor, then deploy the application to the existing GitHub/Vercel project.

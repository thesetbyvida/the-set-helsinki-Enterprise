# The Set Helsinki Enterprise 6.5.2

## Actual Hours Preserve Scheduled Fix

- Adds a clear **Scheduled / Actual hours** edit mode to the 3-week Rota for Admin and Super Admin.
- Scheduled mode edits the published rota exactly as before.
- Actual-hours mode writes only to `actual_start_time` / `actual_end_time` through the existing `set_actual_shift_time` RPC.
- The original scheduled Start/End are shown as a read-only reference while editing actual hours.
- HourCalc and Payroll continue using approved actual hours.
- `Use scheduled` clears the approved actual override without changing the original Rota.
- No new SQL migration is required if Phase 6.5.1 migration `031_rota_actual_hours_admin.sql` has already been applied.

# Phase 6.5.3 — Rota Actual Display Fix

- Actual-hours indicator is shown whenever actual start/end exist; it no longer depends on `actual_approved_at` being present in the client row.
- Scheduled mode shows both **Scheduled** and **Actual ✓** together.
- Scheduled values remain unchanged.
- HourCalc/Payroll continue using approved actual hours.
- Print actual-hours indicator uses the same robust detection.
- No SQL migration required beyond Phase 6.5.1/6.5.2.

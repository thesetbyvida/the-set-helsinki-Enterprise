# The Set Helsinki Enterprise 5.2 — Payroll Validation

Phase 5.2 is a payroll safety/QA release. It does not require a new Supabase migration.

## Changes

- Adds automatic Payroll Validation before a period can be closed.
- Adds deterministic regression checks for evening/night splits, midnight crossing, Saturday→Sunday, the existing Sunday→Monday house rule, S/VL/VV codes, monthly salary and hourly base pay.
- Prevents closing a payroll period while validation errors exist.
- Detects missing monthly salary, missing hourly rate, missing contract hours, zero TES supplement settings and invalid gross results.
- Warns when a monthly employee still has a legacy hourly-rate value stored.
- Fixes monthly-pay reference rate precedence: monthly employees always use `monthly_salary / 159`; a stale `hourly_rate` no longer overrides the monthly basis.
- Keeps Phase 4.5 historical snapshots/locking and later security features intact.

## Deployment

1. Upload this release to the same GitHub repository and `main` branch.
2. No new SQL migration is required for Phase 5.2.
3. Vercel should build package version `5.2.0`.
4. Open Payroll and confirm the Payroll Validation card shows READY before closing a period.

## Important

The validation checks protect against configuration and regression mistakes, but payroll should still be reviewed by a responsible payroll administrator before a period is closed.

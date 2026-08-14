# The Set Helsinki Enterprise 6.4.1

Employee My Work polish / payroll-period fix.

## Fixes
- Payroll period is now calculated as local calendar dates, always 21st → 20th (no UTC one-day shift).
- Previous/Next payroll period navigation preserves exact 21st → 20th boundaries.
- My Work restored to a professional card/table layout.
- Period dates render in the selected language/locale.
- Employee view remains hours-only: no salary amounts.
- No new SQL migration is required.

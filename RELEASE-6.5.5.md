# The Set Helsinki Enterprise 6.5.5

## Scheduled vs Actual totals

- Keeps the published Scheduled rota unchanged.
- Shows approved Actual hours alongside Scheduled hours.
- Adds Scheduled and Actual day totals when split shifts differ.
- Adds Scheduled and Actual weekly totals per employee when approved actual time changes the total.
- HourCalc and Payroll continue using approved Actual time through the existing effective-shift logic.
- Print can include Actual totals when **Print actual hours** is enabled.
- No SQL migration is required beyond the Actual Hours migrations already installed.

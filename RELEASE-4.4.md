# The Set Helsinki Enterprise 4.4 — Payroll TES

Phase 4.4 closes the main payroll calculation gaps while keeping the existing 21st–20th payroll workflow and multi-restaurant structure.

## Changes

- Monthly employees keep their fixed monthly base salary.
- Monthly reference hourly rate now uses **monthly salary / 159** when no explicit hourly rate is stored.
- Evening hours remain 18:00–24:00 and night hours 00:00–06:00.
- Sunday/holiday premium is non-duplicated at the base-hour level and now also doubles overlapping evening/night supplements.
- Aatto is percentage based: after 15:00, +50% of base wage; after 18:00, +50% of the evening supplement too. Aatto is suppressed if the eve itself is a holiday.
- Additional work and overtime are separated:
  - agreed/regular hours up to 120 h: additional work
  - above 120 h in a 3-week period: first 18 h +50%
  - later overtime hours: +100%
- Payroll table now shows Additional, OT 50, OT 100 and Extra base €.
- Hourly and monthly salary handling are kept separate so monthly staff do not become 0 € just because their rota has few hours in the current payroll view.

## Supabase

Run this once in Supabase SQL Editor:

`supabase/migrations/019_payroll_tes_2026.sql`

It updates only payroll setting rows where both evening and night rates are still zero. Existing custom non-zero rates are not overwritten.

## Important

Holiday and eve dates continue to come from `tes_special_days`. Verify that the official dates used by the restaurant are present before final payroll approval.

## Source basis checked for Phase 4.4

- PAM / MaRa employee collective agreement 2025–2028, sections 13, 16, 17 and 18.
- PAM employee wage supplement table effective 1 June 2026.

This software calculation should be reviewed against the company's payroll provider and applicable TES interpretation before payroll is finalized.

### Completed rota periods

Overtime/bank calculations now use only full 3-week rota periods whose end date falls inside the selected payroll period, and they reload the complete shifts for those periods. This avoids calculating overtime from a cut-off fragment of a rota period.

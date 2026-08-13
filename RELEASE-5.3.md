# The Set Helsinki Enterprise 5.3 — Rota Final QA

Phase 5.3 focuses on validating the 3-week rota before it reaches Payroll.

## Included

- Rota QA status panel.
- Blocks saving when a shift has only Start or only End.
- Detects zero-length shifts (same Start and End).
- Detects overlapping multiple shifts for the same employee/day, including overnight intervals.
- Detects ambiguous use of S/VL/VV/V/VP together with clock times.
- Highlights the affected day cell directly in the rota.
- Warns before leaving the page with unsaved changes.
- Warns before switching restaurant or 3-week period with unsaved changes.
- Keeps multi-shift support (up to 4 shifts per employee/day).
- Keeps persistent employee ordering, sticky headers and 3-week print layout.

## Database

No new Supabase migration is required for Phase 5.3.

## Deployment

Upload to the same GitHub repository. Vercel should build version `5.3.0`.

# The Set Helsinki Enterprise 4.1 — POS / Sales

This phase adds the first operational POS/sales module on top of the working 4.0 production build.

## Included
- New **POS / Sales** page in the main navigation.
- Restaurant selector and date-range filtering.
- Manual daily sales entry for testing and fallback use.
- Gross and net sales totals.
- Receipt/source tracking.
- Delete controls for authorized staff.
- Print-friendly sales table.
- POS tables protected with Row Level Security.
- Duplicate receipt protection per restaurant/date.
- Production navigation type correction (the existing Production page is now a valid AppShell page id).

## Supabase
If `016_pos_integration.sql` has NOT been executed yet, run it first.
Then run once:

`supabase/migrations/017_pos_security.sql`

## Deployment
1. Upload/commit the complete 4.1 project to the same GitHub repository.
2. Run the SQL migration above in Supabase SQL Editor.
3. Vercel can deploy the GitHub commit automatically.

## Next
4.2 can add CSV import + validation + import history, using the POS tables introduced here.

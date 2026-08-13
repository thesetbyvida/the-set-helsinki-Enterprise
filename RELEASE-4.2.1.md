# The Set Helsinki Enterprise 4.2.1 — Build Fix

Maintenance release focused on restoring a clean TypeScript/Vercel build.

## Fixed

- `EmployeePortalPage.tsx`: guards the nullable Supabase client before all queries.
- `VacationsPage.tsx`: guards the nullable Supabase client in load, create, approve/reject and cancel actions.
- Keeps the Phase 4.2 POS CSV import work unchanged.
- Package version bumped to `4.2.1`.

## Deployment

No new database migration is required specifically for 4.2.1. Keep the migrations already required by 4.2.

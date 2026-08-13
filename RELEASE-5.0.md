# The Set Helsinki Enterprise 5.0 — Stable Production Release

Phase 5.0 is the stabilization release after phases 4.1–4.9.

## Included

- Canonical application source kept under `src/` only.
- Canonical database migrations kept under `supabase/migrations/` only.
- Removed obsolete root-level duplicate TypeScript/TSX, SQL, Vite config copies and generated `.tsbuildinfo` files that could cause upload/deployment confusion.
- Package version updated to `5.0.0`.
- Added `npm run check` and `npm run verify` commands.
- Added `.gitignore` for build artifacts, local environment files and Vercel metadata.
- Added `.env.example` with the required Supabase environment variable names and no credentials.
- Preserves all Phase 4.9 functionality: multi-restaurant rota, multi-shift days, payroll, TES supplements, payroll history/locking, POS, financial dashboard, employee self-service, permissions and audit.

## Deployment

1. Keep using the same GitHub repository and Vercel project.
2. Replace the repository contents with this 5.0 release, preserving your real `.env` values in Vercel rather than committing them.
3. No new SQL migration is required specifically for Phase 5.0. Your database must already include migrations through `023_security_audit.sql` from Phase 4.9.
4. Commit to the branch connected to Vercel.
5. Vercel should build package version `5.0.0`.

## Production verification

After deployment, verify Login, Restaurants, Employees, 3-week Rota, multiple shifts on the same day, HourCalc, Payroll, historical period locking, Reports, POS, Dashboard, Employee Portal, Vacations/Requests and Audit.

For local verification after dependencies are installed:

```bash
npm run verify
```

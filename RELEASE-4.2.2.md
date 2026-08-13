# The Set Helsinki Enterprise 4.2.2 — Vercel Build Fix

## Fix
- `src/lib/supabase.ts` now always exports a `SupabaseClient` instance instead of `SupabaseClient | null`.
- This removes TypeScript `TS18047: 'supabase' is possibly 'null'` errors in Employee Portal, Vacations, and other Supabase consumers.
- `isSupabaseConfigured` remains available so the application can detect missing environment variables without making the client nullable.

## Deployment
No SQL migration is required for this maintenance release.
Upload this version to the same GitHub repository and let Vercel create a new deployment.

## Required Vercel variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL` (if already used by your deployment)

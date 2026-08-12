# Deploy to GitHub + Vercel

1. Open GitHub Desktop and select `the-set-helsinki-Enterprise`.
2. Use **Repository -> Show in Finder**.
3. Copy the CONTENTS of this folder into the local repository folder. Replace files when macOS asks.
4. Return to GitHub Desktop. You should now see many changed/new files, including the `src/` tree.
5. Commit with message: `Enterprise 3.0 structure fix`.
6. Click **Push origin**.
7. Vercel should start a new deployment automatically.
8. In Vercel, set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
9. Run Supabase migrations from `supabase/migrations/` in numerical order.
10. If user creation/password reset from the app is required, deploy `supabase/functions/admin-users/index.ts` as the `admin-users` Edge Function.

This package fixes the Vercel TypeScript error `TS18003: No inputs were found ... include ["src"]` by using a real `src/` directory.

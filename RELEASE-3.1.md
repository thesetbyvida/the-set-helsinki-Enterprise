# The Set Helsinki Enterprise 3.1

This release consolidates the real project into a standard Vite + React + TypeScript structure.

## Fixed
- Real `src/` directory (the old repository had a file named `src`, which caused Vercel ENOTDIR errors).
- Added `src/vite-env.d.ts` and `vite/client` TypeScript types for `import.meta.env`.
- Added complete app model types in `src/types/app.ts`.
- Vercel-ready Vite entry point at `src/main.tsx`.
- Supabase accepts either `VITE_SUPABASE_PUBLISHABLE_KEY` or legacy `VITE_SUPABASE_ANON_KEY`.
- Rota print cells show shift start–end times and codes/notes; calculated hours remain in the Total column.
- Sticky date header and employee column remain enabled in the rota editor.

## Deploy
1. Replace the repository contents with this package (do not upload the ZIP itself).
2. Commit and push to `main`.
3. Add Vercel environment variables from `.env.example`.
4. Run Supabase migrations in numeric order.
5. Deploy `supabase/functions/admin-users/index.ts` if in-app user creation/password changes are needed.

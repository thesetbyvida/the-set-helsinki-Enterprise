# Deploy to Vercel

1. Upload this project to the root of the GitHub repository (do not upload the enclosing ZIP folder as an extra directory).
2. Vercel should detect Vite automatically.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run the Supabase migrations in `supabase/migrations/` in numerical order.
5. Deploy `supabase/functions/admin-users/index.ts` as the Supabase Edge Function named `admin-users` if you want in-app user creation/password reset.
6. Push to `main`; Vercel will build using `npm run build`.

This package uses a standard `src/` layout so `tsconfig.app.json` with `include: ["src"]` works correctly.

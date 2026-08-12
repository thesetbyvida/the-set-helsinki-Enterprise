# Deploy Enterprise 3.1

1. In GitHub Desktop open **Repository → Show in Finder**.
2. Copy the CONTENTS of this folder into the local repository and replace existing files.
3. Commit: `Enterprise 3.1 Vercel ready`.
4. Push origin.
5. In Vercel add: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) and `VITE_APP_URL`.
6. Vercel build command: `npm run build`; output directory: `dist` (automatic for Vite).
7. Run Supabase migrations `001` → `007` in order.

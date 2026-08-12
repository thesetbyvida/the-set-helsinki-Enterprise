# The Set Helsinki Enterprise 3.0 — Repaired source layout

This package is reorganized for Vite + React + TypeScript and Vercel.

## Important fixes

- Real `src/` folder so `tsconfig.app.json` with `include: ["src"]` works.
- React entry point at `src/main.tsx` matching `index.html`.
- Pages, components, context, libraries and types placed in folders matching their imports.
- Rota print view shows `start_time–end_time` in each day cell and keeps calculated hours in the Total column.
- Rota day headers and employee column use sticky positioning on screen.
- Supabase migrations copied to `supabase/migrations/`.
- `admin-users` Edge Function source placed at `supabase/functions/admin-users/index.ts`.

## Build

```bash
npm install
npm run build
```

## Vercel environment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel before production use.

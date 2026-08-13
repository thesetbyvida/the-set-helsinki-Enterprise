> Current build: Enterprise 3.4 — VV / Hour Bank / Overtime Base

# The Set Helsinki Enterprise 3.0

Consolidated base for the restaurant rota, HourCalc, Users and Payroll application.

## Included

- Multi-restaurant administration
- Employees and user roles
- 3-week rota
- Sticky date header and employee column while editing
- Print layout: one week per landscape A4 page
- Printed rota cells show the actual shift (`09:00–17:00`) and optional code/note; calculated hours stay in Total
- HourCalc / TES breakdown
- Payroll periods and restaurant-specific premium settings
- Supabase RLS helpers for admin authorization

## Supabase installation order

Run these SQL files in **this exact order** in Supabase SQL Editor:

1. `supabase/migrations/001_foundation.sql`
2. `supabase/migrations/002_restaurants.sql`
3. `supabase/migrations/003_employees.sql`
4. `supabase/migrations/004_users_permissions.sql`
5. `supabase/migrations/005_rota.sql`
6. `supabase/migrations/006_hourcalc.sql`
7. `supabase/migrations/007_payroll.sql`

`007_payroll.sql` defensively creates the `current_user_role()` and `is_app_admin()` helpers as well, so the earlier error `function public.is_app_admin() does not exist` is avoided.

## Local build

```bash
npm install
npm run build
```

## Vercel

Set the Supabase environment variables expected by `src/lib/supabase.ts`, connect the GitHub repository to Vercel, and deploy the `main` branch.

## Important

Do not upload Vercel's compiled `Resources` files over the source project. Deploy this source repository so Vite compiles it normally.

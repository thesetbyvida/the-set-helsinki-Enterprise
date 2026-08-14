# The Set Helsinki Enterprise 6.3

Employee Security + Invitation Password Setup.

- Employee navigation is restricted to Rota, My Work and Requests.
- Employee sessions no longer receive Payroll/Users/Employees/Restaurants/Security/Settings pages.
- Rota uses a safe employee directory with names only; salaries and private employee fields are excluded.
- New invitations redirect to `/set-password` before normal app use.
- Adds `026_employee_security_password.sql` to tighten employee RLS and financial access.

## Deploy
1. Run `supabase/migrations/026_employee_security_password.sql`.
2. Redeploy `supabase/functions/admin-users/index.ts`.
3. Add `https://YOUR_APP_DOMAIN/set-password` to Supabase Auth Redirect URLs.
4. Deploy this project to the existing GitHub/Vercel project.

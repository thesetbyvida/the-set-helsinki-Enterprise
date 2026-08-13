# The Set Helsinki Enterprise 4.0 — Production Deployment

## 1. GitHub
Commit and push:

`Enterprise 4.0 Production`

## 2. Supabase
Run once:

`supabase/migrations/015_production_hardening.sql`

## 3. Vercel environment variables
Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never expose `service_role` as a `VITE_*` variable.

## 4. Production checks
After deployment, open the app and visit the Production Status page if routed in your navigation.
Verify that required tables are reachable.

## 5. Backups
Enable Supabase backups appropriate to your plan and keep periodic exports of:
- profiles
- employees
- restaurants
- employee_restaurants
- rota_shifts
- payroll settings/adjustments
- vv/hour-bank data
- sales_daily

## 6. Before live payroll use
Confirm current TES compensation values and legal payroll rules with the applicable collective agreement/accounting workflow.

# The Set Helsinki Enterprise 6.2.1 — Employee → User automatic invitation fix

- Fixes the missing call from Employees to the `admin-users` Edge Function.
- New employees with an email are automatically invited to Supabase Auth.
- Creates/updates the employee Profile with role `employee`.
- Links `employees.auth_user_id` to the Auth user.
- Copies employee restaurant assignments to `user_restaurants`.
- Existing Auth emails are linked instead of duplicated.
- Invitation redirect uses the `APP_URL` Edge Function secret.

## Deploy
1. Run `supabase/migrations/025_employee_user_integration.sql` in Supabase SQL Editor.
2. Replace the deployed `admin-users` Edge Function code with `supabase/functions/admin-users/index.ts` and deploy it.
3. Confirm Edge Function secret `APP_URL` is the production app URL.
4. Upload this project to the existing GitHub repository; Vercel deploys automatically.
5. Create one NEW test employee with a NEW email and restaurant assignment. Confirm an `admin-users` invocation and an Auth user.

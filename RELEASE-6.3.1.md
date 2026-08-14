# The Set Helsinki Enterprise 6.3.1

## Unified Employee & User Management

- Employees is now the main place to manage employee app access.
- Admins can create app access for an existing employee directly from the employee card.
- App access can be enabled or disabled without deleting the employee.
- Deleting an employee with linked access also deletes the corresponding Supabase Auth user, profile and user-restaurants links.
- The Users page is now shown only to Super Admin for special administrative accounts.
- Employee records display whether app access is linked.

## Deployment

No new SQL migration is required if 025 and 026 are already installed.
Redeploy `supabase/functions/admin-users/index.ts`, then deploy the web app.

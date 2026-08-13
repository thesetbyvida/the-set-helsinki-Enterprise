# The Set Helsinki Enterprise 3.6 — Employee App

Adds the first real employee self-service module:

- My Work / employee portal page
- Upcoming personal rota shifts
- Restaurant location per shift
- Hour bank balance
- VV earned/used/available
- Employee-to-login linking by matching email
- `employee_requests` database foundation for vacation / shift-change requests
- RLS policies so employees can only see/create their own requests while admins can manage them

## Supabase
Run once:

`supabase/migrations/012_employee_app.sql`

## Important
For an employee account to see its own data, the email in `profiles` / Supabase Auth must match the email in `employees`.

# The Set Helsinki Enterprise 3.7 — Vacations & Requests

Adds the real vacation/request workflow.

## Employee
- Vacation request
- Shift-change request
- Availability request
- Date range + notes
- See own request history/status
- Cancel a pending request

## Admin / Super Admin
- See requests from all employees
- Approve or reject pending requests
- Request status tracking
- Review metadata foundation

## Supabase
Run once after deploying:

`supabase/migrations/013_vacations_requests.sql`

This release builds on the `employee_requests` table created in 3.6.

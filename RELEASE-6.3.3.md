# The Set Helsinki Enterprise 6.3.3 — Employee Access Lockdown

## Employee access
- Full 3-week rota for the employee's assigned restaurant(s), read-only.
- My Work: own hours, shifts, VV, hour bank and requests only.
- Vacations / Requests: own employee workflow.

## Blocked for employee
- Restaurants administration
- Employees
- Users
- HourCalc
- Payroll
- VV administration
- Reports
- POS / Sales
- Security / Audit
- Settings

## Database hardening
Run `supabase/migrations/028_employee_access_lockdown.sql`. It blocks direct employee reads of payroll, restaurant administration, sales and POS while preserving safe rota directory RPCs.

## Rota privacy
Employees may see the names and shifts of all colleagues in restaurants assigned to them. Salary, hourly rate, private contact information, bank/VV balances of colleagues and payroll data are not returned.

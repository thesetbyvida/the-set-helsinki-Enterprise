# The Set Helsinki Enterprise 6.5

## Employee Actual Hours & Approval Workflow

- Per-employee permission: Allow own time corrections.
- Approval is required by default; optional direct/auto approval can be enabled per employee.
- Employees submit actual Start/End from My Work for their own scheduled shifts only.
- Pending corrections do not affect Rota, HourCalc, or Payroll.
- Admin/Super Admin/Manager can review pending corrections in HourCalc.
- On approval, actual times are stored separately on `rota_shifts`; scheduled rota times remain unchanged.
- HourCalc and Payroll use approved actual times automatically.
- Closed payroll periods cannot be corrected or approved.
- RLS/RPC protects employee ownership and administrative review.
- No monetary data is added to the employee portal.

## Installation

1. Run `supabase/migrations/030_employee_actual_hours.sql` in Supabase SQL Editor.
2. Upload this release to the same GitHub repository/Vercel project.
3. In Employees, edit a worker and enable **Allow employee to submit corrections to own actual hours**.
4. Keep **Require Admin / Super Admin approval** enabled for the recommended workflow.
5. Employee submits actual times in My Work.
6. Admin reviews them in HourCalc → Actual hours approvals.

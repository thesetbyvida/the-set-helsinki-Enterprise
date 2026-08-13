# The Set Helsinki Enterprise 4.8

## Employee Portal & Requests

Phase 4.8 activates the employee self-service modules that were already present in the codebase and extends them for daily use.

### Included

- New **My work** navigation page for employees.
- New **Vacations / Requests** navigation page.
- Employee view of upcoming and recent rota shifts.
- Split shifts are displayed separately using `shift_slot`.
- Correct employee hour-bank field (`bank_hours`).
- VV earned / used / available summary.
- Request summary: pending, approved, rejected and cancelled.
- Vacation requests.
- VV / annual free-day requests.
- Availability requests.
- Shift-change requests with requested start/end time.
- Employee request history and cancellation while pending.
- Admin request queue with approval/rejection and optional admin note.
- Approval metadata is stored through the secure `review_employee_request` RPC.
- English / Spanish / Finnish navigation labels for the new modules.

## Supabase

Run this migration before deploying the UI:

`supabase/migrations/022_employee_self_service.sql`

It is additive and keeps existing `employee_requests` data.

## Deployment

1. Run migration 022 in Supabase SQL Editor.
2. Upload this version to the same GitHub repository.
3. Vercel should build version `4.8.0`.
4. Test one employee login and one admin login.

## Important

Approving a vacation/VV request records the approval but does **not** automatically rewrite the rota. This is intentional so an admin can review the rota before applying codes or removing shifts.

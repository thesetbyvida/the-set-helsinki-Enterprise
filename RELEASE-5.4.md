# The Set Helsinki Enterprise 5.4 — Employee Portal Final

## What is new

- Employee requests are restaurant-aware.
- Employees assigned to more than one restaurant can choose the restaurant for a request.
- Vacation and VV approvals can be applied safely to the rota by an Admin/Super Admin.
- Vacation is written to the rota as `VL`; VV is written as `VV`.
- Existing worked shifts are never overwritten automatically. A conflict stops the operation and tells the admin which date must be reviewed manually.
- Applying a request requires an existing 3-week rota period for every requested date.
- Request history shows restaurant and whether an approved request was applied to the rota.
- Split shifts and the Phase 5.3 Rota QA remain unchanged.

## Database migration

Run this file in Supabase SQL Editor before deploying the UI:

`supabase/migrations/024_employee_portal_final.sql`

## Safe workflow

1. Employee submits Vacation or VV and selects the restaurant.
2. Admin reviews the request.
3. `Approve` records approval only.
4. `Approve + Rota` records approval and writes `VL` or `VV` into the existing rota.
5. If a date already contains a real shift, the operation stops rather than overwriting it.

Shift-change and availability requests remain approval records in 5.4; they are not auto-written because a split-shift day may contain multiple shift slots and an automatic edit could modify the wrong shift.

# The Set Helsinki Enterprise 6.4.2 — Requests → Rota + clean employee form

## Included

- Final `Approve + Rota` RPC for Vacation and VV requests.
- Vacation is written as `VL`; annual free day is written as `VV`.
- Validates the whole requested range before writing anything.
- Never overwrites an existing worked shift, another code, or a split shift in slots 2–4.
- Requires an existing 3-week rota period for every requested date.
- Marks approved requests as applied and records reviewer/application timestamps.
- Consolidates missing `employee_requests` columns and removes obsolete RPC overloads.
- Employee creation form is hardened against Chrome personal-info autofill (email/phone/address).
- Employee form resets to blank values after save/cancel.

## Install

1. Supabase SQL Editor: run `supabase/migrations/029_requests_rota_apply_and_form_hardening.sql`.
2. Upload this release to the existing GitHub repository / Vercel project.
3. Test one VV request with `Approve + Rota` before testing a multi-day Vacation request.

No Edge Function update is required for 6.4.2.

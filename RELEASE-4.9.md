# The Set Helsinki Enterprise 4.9 — Security & Audit

## Included
- Restaurant-scoped access hardening.
- Super Admin vs Admin restaurant management separation.
- Payroll settings, payroll adjustments and closed payroll history restricted to permitted administrators.
- Sales, POS import jobs, VV and overtime policies scoped by restaurant.
- Automatic audit events for rota shifts, payroll periods/adjustments, POS sales, manual sales and employee requests.
- New Security / Audit page for Admin and Super Admin.
- Managers no longer see Payroll or financial Reports in navigation.
- Production Status now checks the audit table.

## Supabase
Run `supabase/migrations/023_security_audit.sql` in Supabase SQL Editor before deploying 4.9.

## Deployment
Upload this version to the same GitHub repository. Vercel should build package version `4.9.0`.

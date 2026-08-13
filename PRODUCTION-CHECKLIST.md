# Production certification checklist — The Set Helsinki Enterprise 5.6

## Deployment
- [ ] Vercel deployment is Ready and the build uses package version 5.6.0.
- [ ] `VITE_SUPABASE_URL` is configured in Vercel.
- [ ] `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` is configured in Vercel.
- [ ] Required Supabase migrations through 024 have been applied where used by the installation.
- [ ] Settings → System status shows automated checks READY.

## Access and security
- [ ] Super Admin login works.
- [ ] Admin login works.
- [ ] Employee login works.
- [ ] Restaurant-scoped access is correct.
- [ ] Employee account cannot access restricted Payroll/financial administration.
- [ ] Audit page records protected changes.

## Rota
- [ ] Restaurant and period selectors work.
- [ ] Employee order persists after refresh.
- [ ] Two shifts for one employee on the same date save and survive refresh.
- [ ] 3-week rota daily/weekly totals are correct.
- [ ] Cross-midnight shifts are correct.
- [ ] Saturday→Sunday split is correct.
- [ ] Rota QA blocks invalid/incomplete or overlapping shifts.
- [ ] Print output contains all three weeks and all shift start/end times.

## Payroll
- [ ] Payroll Validation shows READY.
- [ ] Monthly-salary employee shows the monthly base salary.
- [ ] Hourly employee calculates base pay from payable hours and hourly rate.
- [ ] Evening/night/Sunday/holiday/aatto values are checked with known test shifts.
- [ ] S, VL and VV are checked with known test entries.
- [ ] 21→20 pay period selection works historically.
- [ ] Closed payroll snapshot remains frozen until reopened.

## Reports / POS / Dashboard
- [ ] Closed Reports use historical snapshots.
- [ ] CSV export works.
- [ ] Excel-compatible export works.
- [ ] Print/PDF works.
- [ ] POS import/manual sales appear once in Dashboard (no duplicate daily sales).
- [ ] Labor cost %, sales/hour and labor cost/hour are plausible for a known period.

## Employee portal
- [ ] Employee sees own shifts, hour bank and VV.
- [ ] Vacation request can be submitted and reviewed.
- [ ] VV request can be submitted and reviewed.
- [ ] Approve + Rota creates the expected VL/VV entry when there is no shift conflict.
- [ ] Existing real shifts are not overwritten by an approval.

## Operations
- [ ] Backup procedure is understood and tested.
- [ ] A rollback deployment is known/available in Vercel.
- [ ] One complete real workflow has been tested: Rota → Payroll → Close period → Reports.

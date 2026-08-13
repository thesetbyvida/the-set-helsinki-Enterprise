# The Set Helsinki Enterprise 5.6

## Production Certification

Phase 5.6 is the final certification phase before the production baseline.

### Added
- Production certification summary under Settings → System status.
- Automated Supabase connectivity/table checks.
- Built-in payroll regression tests for evening, night, cross-midnight, Saturday→Sunday, Sunday overnight house rule, S, VL, VV, monthly salary and hourly salary.
- Clear READY / ATTENTION result with passed-check count.
- Manual end-to-end production checklist for workflows that require real accounts and real restaurant data.
- Release status identifies the running application as 5.6.0.

### Database
No new SQL migration is required for 5.6.
The project expects all migrations used by prior releases, including the employee portal final migration 024 where applicable.

### Certification rule
An automated READY result is necessary but not sufficient for final operational sign-off. Complete the manual checklist with real data before declaring the installation fully production certified.

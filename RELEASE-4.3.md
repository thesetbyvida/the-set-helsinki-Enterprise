# The Set Helsinki Enterprise 4.3

## Monthly salary payroll

Phase 4.3 stabilizes payroll for salaried employees while keeping hourly employees unchanged.

- A positive `monthly_salary` now takes precedence as a monthly pay basis, even for older employee records whose contract type was not migrated correctly.
- Monthly employees receive the configured fixed monthly salary as Base € for a complete 21–20 payroll period.
- Worked hours, TES hour categories, overtime and hour-bank figures remain visible independently from fixed salary.
- Sunday/holiday 100% premiums use the employee hourly rate when provided. For a monthly employee with no hourly rate, a reference hourly rate is derived from monthly salary and contracted 3-week hours.
- Payroll now shows Pay basis, reference hourly rate and Monthly € explicitly.
- Reports now show Pay basis and Base payroll separately from Gross payroll, making salaried employees visible in payroll and labor-cost reports.

## Victor / other monthly employees

In Employees, set `Monthly Salary` to the agreed fixed monthly amount. `Contract type = monthly` is recommended. Phase 4.3 also recognizes an existing positive Monthly Salary so older records do not remain at €0 because of a stale contract type.

No new Supabase migration is required for 4.3 because `contract_type`, `contract_hours`, `hourly_rate` and `monthly_salary` already exist in the employees table.

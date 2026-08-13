# The Set Helsinki Enterprise 4.2

## Phase 4.2 — POS CSV Import

This release extends the working 4.1 POS / Sales module with bulk CSV import.

### Included
- CSV file selector directly in POS / Sales.
- Preview before import (first 100 rows).
- Validation of dates and money columns before saving.
- Supports comma, semicolon and tab-delimited files.
- Supports `YYYY-MM-DD` and `DD.MM.YYYY` dates.
- Supports decimal comma and decimal point values.
- Flexible headers in English, Finnish and Spanish for Date, Receipt, Gross, Net and Source.
- Import status showing valid and invalid rows.
- Duplicate receipt protection using the existing restaurant/date/receipt unique index.
- POS import job history fields for imported, skipped and failed rows.
- Database RPC for efficient batch import while keeping Supabase RLS active.
- Manual POS entry from 4.1 remains available.

## Install / update
1. Upload this release to the SAME GitHub project. Do not create a new project.
2. In Supabase SQL Editor, make sure migrations `016_pos_integration.sql` and `017_pos_security.sql` have already been run.
3. Run `supabase/migrations/018_pos_csv_import.sql`.
4. Commit/push to GitHub.
5. Let Vercel deploy the new build.

## Recommended CSV
```csv
Date;Receipt;Gross;Net;Source
2026-08-01;1001;1250,50;996,41;restolution
2026-08-02;1002;1435,80;1144,06;restolution
```

`Receipt` and `Source` are optional. At least Date plus Gross or Net must be present.

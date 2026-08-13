# The Set Helsinki Enterprise 4.6 — Financial Dashboard

Phase 4.6 connects the financial dashboard to both payroll and POS sales.

## Included

- Gross sales and net sales by restaurant.
- Calculated payroll labor cost for the selected 21→20 payroll period.
- Labor cost percentage: gross payroll / gross sales.
- Worked hours and sales per worked hour.
- Labor cost per worked hour.
- Restaurant-by-restaurant comparison table.
- Automatic POS integration from `pos_sales`.
- Manual `sales_daily` remains as a fallback when no POS data exists.
- POS takes priority over manual sales to avoid counting the same restaurant/day twice.
- Sales source indicator: POS / Manual / No sales.
- 14-day effective sales trend.
- Print / PDF action for the financial dashboard.
- Existing manual sales entry remains available to admins.

## Database

No new SQL migration is required for Phase 4.6 if migrations 014, 016 and 017 are already installed.

Required existing tables:

- `sales_daily`
- `pos_sales`
- payroll / rota tables from previous phases

## Deploy

1. Upload the Phase 4.6 project files to the same GitHub repository.
2. Do not create a new Vercel project.
3. Let Vercel deploy the new commit.
4. The build version should show `the-set-helsinki-enterprise@4.6.0`.
5. Open Dashboard and select a restaurant or All restaurants.

## Sales priority

For a restaurant/day:

1. Imported POS data is used when POS records exist.
2. Manual daily sales are used only when there is no POS data for that day.

This prevents imported POS sales and manually entered sales from being added together accidentally.

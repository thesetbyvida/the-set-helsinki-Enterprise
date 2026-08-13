# The Set Helsinki Enterprise 3.8 — Dashboard PRO

## New
- Dashboard PRO replaces the old placeholder dashboard.
- Restaurant selector and 21–20 payroll-period navigation.
- Sales by restaurant.
- Payroll/labor cost by restaurant.
- Worked hours.
- Labor-cost percentage.
- Sales per worked hour (productivity).
- Active employee count.
- Pending employee-request count.
- 14-day sales trend.
- Daily sales entry for admin / super_admin.
- Multi-restaurant performance table.

## Supabase
Run once:

`supabase/migrations/014_dashboard_pro.sql`

The new `sales_daily` table stores one sales figure per restaurant/day.
The dashboard combines that with the existing Rota → HourCalc → Payroll engine.

## Note
Labor cost is based on the Payroll PRO calculation already in the application.
Sales must be entered/imported before productivity and labor-cost percentage can be calculated.

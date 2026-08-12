# Release 3.0

This package consolidates the Phase 7 code into a cleaner single base. It also fixes the SQL dependency that caused `public.is_app_admin()` to be missing during the Payroll migration.

The rota print component uses `start_time` and `end_time` for printed cells. Worked-hour totals remain separate in the Total column. The editor keeps the date header and employee column sticky for easier work on long rotas.

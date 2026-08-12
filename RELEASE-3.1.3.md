# Enterprise 3.1.3 — Rota order fix

- Adds a dedicated employee-order panel above the 3-week rota.
- Admin/super_admin can move employees with visible Up/Down buttons.
- Order updates immediately and persists in employee_restaurants.display_order.
- Includes idempotent migration 008_employee_order.sql to ensure RLS and display_order are correct.

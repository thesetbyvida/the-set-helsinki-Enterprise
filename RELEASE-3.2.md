# The Set Helsinki Enterprise 3.2

## Employee rota ordering fix
- Employee order is saved with one atomic Supabase RPC instead of many client-side UPDATE calls.
- The RPC verifies active `admin` / `super_admin` access and then writes the full order in one transaction.
- Rota reloads `employee_restaurants` immediately after save so the displayed order always matches the database.
- Both drag-and-drop and visible ↑ / ↓ controls remain available.

## Required database step
Run `supabase/migrations/009_employee_order_rpc.sql` once in Supabase SQL Editor before testing ordering.

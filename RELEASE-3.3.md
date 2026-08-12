# The Set Helsinki Enterprise 3.3

## Rota UX cleanup

- Removed the duplicated employee-order panel above the 3-week rota.
- Employee order controls remain directly beside each employee name in the rota table.
- Drag-and-drop and ↑ / ↓ controls still save the order through the existing atomic Supabase RPC.
- Success messages now disappear automatically after 2.5 seconds instead of occupying permanent space.
- No new database migration is required when upgrading from 3.2.

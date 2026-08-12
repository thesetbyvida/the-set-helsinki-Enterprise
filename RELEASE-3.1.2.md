# The Set Helsinki Enterprise 3.1.2

- Restores employee ordering in the 3-week rota.
- Admin and super_admin can drag employee names to reorder them.
- Up/down buttons are also available for precise ordering.
- The order is saved persistently in `employee_restaurants.display_order` per restaurant.
- The same order is used in all three weeks and survives refresh/redeploy.
- No database migration is required because `display_order` already exists.

# The Set Helsinki Enterprise 6.4 — Employee My Work Final

- My Work uses the 21→20 payroll period selector.
- Employee sees only their own hours and balances; no salary amounts are rendered.
- Adds Evening, Night, Sunday, Holiday, Aatto, S, VL, VV, Overtime and Hour Bank cards.
- Adds detailed shift table for the selected payroll period, including multi-shift slots.
- Uses the safe `rota_restaurant_directory()` RPC so employees can see restaurant names without restaurant administration access.
- Adds VV progress toward the next earned VV day.
- Keeps 6.3.3 employee access lockdown unchanged.
- English / Finnish / Spanish labels added to My Work.

No new SQL migration is required if migrations through 028 are already applied.

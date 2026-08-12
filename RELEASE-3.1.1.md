# The Set Helsinki Enterprise 3.1.1

Usability and diagnostics update.

- Employee editor actions remain visible at the bottom of the right-hand editor while the form scrolls.
- The employee editor uses its own viewport-height scroll area on desktop, so saving no longer requires scrolling the entire page to the bottom.
- Supabase/API error objects are converted into useful text instead of rendering `[object Object]` across Employees, Rota, HourCalc, Payroll, Restaurants and Users pages.
- Based on Enterprise 3.1 Vercel Ready; existing Supabase schema and environment variables are unchanged.

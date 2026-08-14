# The Set Helsinki Enterprise 6.3.2

## Safe invitation session + My Work hours fix

- Invitation links now carry the employee id and Set Password verifies that the active Auth user matches that employee before changing any password.
- Invitation tokens in the URL are explicitly adopted before password update, preventing an already signed-in admin account from being changed accidentally.
- After password creation the invitation session is signed out and the employee signs in normally.
- My Work links employees by `auth_user_id` first, with email fallback only for legacy records.
- Removed the invalid `vv_transactions` dependency. VV uses yearly rota hours plus `vv_adjustments`.
- Added 21→20 personal hours view: worked, evening, night, Sunday, holiday, S, VL, VV and hour bank. No euro amounts.
- VV/overtime RLS is tightened so employees can read only their own rows.

Run `supabase/migrations/027_employee_mywork_security.sql` and redeploy the `admin-users` Edge Function.

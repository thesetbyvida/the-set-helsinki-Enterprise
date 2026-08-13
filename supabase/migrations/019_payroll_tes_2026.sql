-- The Set Helsinki Enterprise 4.4 — Payroll TES 2026 defaults
-- Idempotent migration. It only replaces zero/default supplement values.
-- Current MaRa/PAM employee TES from 1.9.2025 through 30.6.2027:
-- evening 18:00–24:00 = 1.40 €/h
-- night   00:00–06:00 = 2.37 €/h
-- Percentage-based Sunday/holiday, aatto and overtime are calculated in application code.

update public.payroll_settings
set evening_eur_per_hour = 1.40,
    night_eur_per_hour = 2.37,
    updated_at = now()
where coalesce(evening_eur_per_hour, 0) = 0
  and coalesce(night_eur_per_hour, 0) = 0;

-- Legacy columns remain for backwards compatibility, but 4.4 no longer uses them
-- to calculate aatto or overtime because those are percentage-based TES rules.
comment on column public.payroll_settings.eve_eur_per_hour is
  'Legacy compatibility field. Enterprise 4.4 calculates aatto as percentage-based TES compensation.';
comment on column public.payroll_settings.overtime_eur_per_hour is
  'Legacy compatibility field. Enterprise 4.4 calculates overtime as 50%/100% percentage-based TES compensation.';

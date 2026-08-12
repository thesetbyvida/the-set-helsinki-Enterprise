import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import { formatError } from "../lib/errors";
import {
  aggregatePayrollHours,
  calculatePayrollRow,
  defaultPayrollSettings,
  getPayrollSettings,
  listPayrollShifts,
  listPayrollSpecialDays,
  movePayrollPeriod,
  payrollPeriodForDate,
  savePayrollSettings,
  type PayrollRow,
  type PayrollSettings,
} from "../lib/payroll";
import { parseIsoDate } from "../lib/rota";
import { emptyTes } from "../lib/tes";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";

const hours = (v: number) => v.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
const eur = (v: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(v);

export function PayrollPage() {
  const { language, profile, t } = useApp();
  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [settings, setSettings] = useState<PayrollSettings>(defaultPayrollSettings(""));
  const [period, setPeriod] = useState(() => payrollPeriodForDate(new Date(), 21));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canEditSettings = profile?.role === "admin" || profile?.role === "super_admin";

  useEffect(() => {
    (async () => {
      try {
        const [r, e, a] = await Promise.all([listRestaurants(), listEmployees(), listEmployeeRestaurants()]);
        const active = r.filter((x) => x.active);
        setRestaurants(active);
        setEmployees(e.filter((x) => x.active));
        setAssignments(a);
        if (active.length) setRestaurantId(active[0].id);
      } catch (e) { setError(formatError(e)); }
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        const s = await getPayrollSettings(restaurantId);
        setSettings(s);
        setPeriod(payrollPeriodForDate(parseIsoDate(period.start), s.period_start_day || 21));
      } catch (e) { setError(formatError(e)); }
    })();
    // restaurant change intentionally preserves the month being viewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const visibleEmployees = useMemo(() => {
    const order = new Map(assignments.filter((x) => x.restaurant_id === restaurantId).map((x) => [x.employee_id, x.display_order]));
    return employees.filter((e) => order.has(e.id)).sort((a, b) => (order.get(a.id) || 999) - (order.get(b.id) || 999) || a.name.localeCompare(b.name));
  }, [assignments, employees, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true); setError("");
        const [shifts, specialDays] = await Promise.all([
          listPayrollShifts(restaurantId, period.start, period.end),
          listPayrollSpecialDays(period.start, period.end),
        ]);
        const byEmployee = aggregatePayrollHours(shifts, specialDays);
        setRows(visibleEmployees.map((employee) => calculatePayrollRow(employee, byEmployee.get(employee.id) || emptyTes(), settings)));
      } catch (e) { setError(formatError(e)); }
      finally { setLoading(false); }
    })();
  }, [restaurantId, period.start, period.end, visibleEmployees, settings]);

  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const restaurantName = restaurants.find((r) => r.id === restaurantId)?.name || "";
  const totals = useMemo(() => rows.reduce((a, r) => ({
    base: a.base + r.base_pay, evening: a.evening + r.evening_pay, night: a.night + r.night_pay,
    premium: a.premium + r.premium_100_pay, eve: a.eve + r.eve_pay, gross: a.gross + r.gross_pay,
  }), { base: 0, evening: 0, night: 0, premium: 0, eve: 0, gross: 0 }), [rows]);

  async function saveRates() {
    try {
      setSavingSettings(true); setError(""); setNotice("");
      await savePayrollSettings(settings);
      setNotice(t.payrollSettingsSaved || "Payroll settings saved.");
    } catch (e) { setError(formatError(e)); }
    finally { setSavingSettings(false); }
  }

  function changeStartDay(raw: number) {
    const value = Math.min(28, Math.max(1, raw || 21));
    setSettings((s) => ({ ...s, period_start_day: value }));
    setPeriod(payrollPeriodForDate(parseIsoDate(period.start), value));
  }

  return <div className="payroll-page">
    <div className="panel payroll-toolbar no-print">
      <div><h2>{t.payroll}</h2><p className="muted">{t.payrollDescription || "Payroll period, TES hours and compensation."}</p></div>
      <div className="payroll-controls">
        <label><span>{t.restaurant || "Restaurant"}</span><select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>{t.payrollPeriod || "Payroll period"}</span><input value={`${period.start} – ${period.end}`} readOnly /></label>
        <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, -1, settings.period_start_day))}>← {t.previous || "Previous"}</button>
        <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, 1, settings.period_start_day))}>{t.next || "Next"} →</button>
        <button onClick={() => window.print()}>{t.print || "Print"}</button>
      </div>
    </div>

    {error && <div className="alert">{error}</div>}{notice && <div className="notice">{notice}</div>}

    <div className="panel payroll-rates no-print">
      <div><h3>{t.payrollRates || "Payroll rates"}</h3><p className="muted">{t.payrollRateNote || "Enter the official current TES euro supplements used by your company. Sunday/holiday 100% is calculated from each employee's hourly rate."}</p></div>
      <div className="payroll-rate-grid">
        <label><span>{t.periodStartDay || "Period starts on day"}</span><input type="number" min="1" max="28" disabled={!canEditSettings} value={settings.period_start_day} onChange={(e) => changeStartDay(Number(e.target.value))}/></label>
        <label><span>{t.eveningRate || "Evening €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEditSettings} value={settings.evening_eur_per_hour} onChange={(e) => setSettings({...settings, evening_eur_per_hour:Number(e.target.value)})}/></label>
        <label><span>{t.nightRate || "Night €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEditSettings} value={settings.night_eur_per_hour} onChange={(e) => setSettings({...settings, night_eur_per_hour:Number(e.target.value)})}/></label>
        <label><span>{t.eveRate || "Aatto €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEditSettings} value={settings.eve_eur_per_hour} onChange={(e) => setSettings({...settings, eve_eur_per_hour:Number(e.target.value)})}/></label>
        {canEditSettings && <button onClick={saveRates} disabled={savingSettings}>{savingSettings ? (t.saving || "Saving…") : (t.save || "Save")}</button>}
      </div>
    </div>

    <div className="print-payroll-title"><h1>The Set Helsinki — {t.payroll}</h1><p>{restaurantName} · {fmt.format(parseIsoDate(period.start))} – {fmt.format(parseIsoDate(period.end))}</p></div>

    <div className="panel payroll-table-wrap">
      {loading ? <p>{t.loading || "Loading…"}</p> : <table className="payroll-table">
        <thead><tr>
          <th>{t.employeeName || "Employee"}</th><th>{t.contractType || "Contract"}</th><th>{t.hourlyRate || "€/h"}</th>
          <th>{t.baseHours || "Base h"}</th><th>{t.eveningHours || "Evening h"}</th><th>{t.nightHours || "Night h"}</th><th>{t.sundayHours || "Sunday h"}</th><th>{t.holidayHours || "Holiday h"}</th><th>{t.premium100 || "100% h"}</th><th>{t.eveHours || "Aatto h"}</th><th>S</th><th>VL</th><th>VV</th>
          <th>{t.basePay || "Base €"}</th><th>{t.eveningPay || "Evening €"}</th><th>{t.nightPay || "Night €"}</th><th>{t.premium100Pay || "100% €"}</th><th>{t.evePay || "Aatto €"}</th><th>{t.grossPay || "Total €"}</th>
        </tr></thead>
        <tbody>{rows.map((r) => <tr key={r.employee.id}>
          <td>{r.employee.name}</td><td>{r.employee.contract_type}</td><td>{eur(Number(r.employee.hourly_rate || 0), locale)}</td>
          <td>{hours(r.hours.base_hours)}</td><td>{hours(r.hours.evening_hours)}</td><td>{hours(r.hours.night_hours)}</td><td>{hours(r.hours.sunday_hours)}</td><td>{hours(r.hours.holiday_hours)}</td><td>{hours(r.hours.premium_100_hours)}</td><td>{hours(r.hours.eve_hours)}</td><td>{hours(r.hours.sick_hours)}</td><td>{hours(r.hours.vacation_hours)}</td><td>{hours(r.hours.vv_days)}</td>
          <td>{eur(r.base_pay, locale)}</td><td>{eur(r.evening_pay, locale)}</td><td>{eur(r.night_pay, locale)}</td><td>{eur(r.premium_100_pay, locale)}</td><td>{eur(r.eve_pay, locale)}</td><td><strong>{eur(r.gross_pay, locale)}</strong></td>
        </tr>)}</tbody>
        <tfoot><tr><td colSpan={13}>{t.total || "Total"}</td><td>{eur(totals.base, locale)}</td><td>{eur(totals.evening, locale)}</td><td>{eur(totals.night, locale)}</td><td>{eur(totals.premium, locale)}</td><td>{eur(totals.eve, locale)}</td><td><strong>{eur(totals.gross, locale)}</strong></td></tr></tfoot>
      </table>}
    </div>
    <div className="panel payroll-footnote no-print">{t.payrollFootnote || "Base hours include worked hours plus paid S and VL. VV is tracked separately. Sunday/holiday premium uses the non-duplicated 100% hour total."}</div>
  </div>;
}

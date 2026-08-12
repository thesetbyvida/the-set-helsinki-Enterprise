import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import { addDays, isoDate, mondayOf, parseIsoDate } from "../lib/rota";
import { calculateEmployees, listShiftsForRange, listSpecialDays } from "../lib/hourcalc";
import { emptyTes, type TesBreakdown } from "../lib/tes";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";

function h(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function HourCalcPage() {
  const { language, t } = useApp();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [startDate, setStartDate] = useState(() => isoDate(mondayOf(new Date())));
  const [rows, setRows] = useState<Map<string, TesBreakdown>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";
  const endDate = useMemo(() => isoDate(addDays(parseIsoDate(startDate), 20)), [startDate]);

  useEffect(() => {
    (async () => {
      try {
        const [r, e, a] = await Promise.all([listRestaurants(), listEmployees(), listEmployeeRestaurants()]);
        const active = r.filter((item) => item.active);
        setRestaurants(active);
        setEmployees(e.filter((item) => item.active));
        setAssignments(a);
        if (active.length) setRestaurantId(active[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [shifts, specialDays] = await Promise.all([
          listShiftsForRange(restaurantId, startDate, endDate),
          listSpecialDays(startDate, isoDate(addDays(parseIsoDate(endDate), 1))),
        ]);
        setRows(calculateEmployees(shifts, specialDays));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId, startDate, endDate]);

  const visibleEmployees = useMemo(() => {
    const order = new Map(
      assignments.filter((x) => x.restaurant_id === restaurantId).map((x) => [x.employee_id, x.display_order])
    );
    return employees
      .filter((employee) => order.has(employee.id))
      .sort((a, b) => (order.get(a.id) || 999) - (order.get(b.id) || 999) || a.name.localeCompare(b.name));
  }, [employees, assignments, restaurantId]);

  function changeStart(value: string) {
    if (value) setStartDate(isoDate(mondayOf(parseIsoDate(value))));
  }

  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="hourcalc-page">
      <div className="panel hourcalc-toolbar no-print">
        <div>
          <h2>{t.hourCalc || "HourCalc"}</h2>
          <p className="muted">{t.hourCalcDescription || "TES hour breakdown calculated from the 3-week rota."}</p>
        </div>
        <div className="hourcalc-controls">
          <label><span>{t.restaurant || "Restaurant"}</span><select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label><span>{t.periodStart || "Period start"}</span><input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} /></label>
          <button className="secondary" onClick={() => setStartDate(isoDate(addDays(parseIsoDate(startDate), -21)))}>← {t.previous || "Previous"}</button>
          <button className="secondary" onClick={() => setStartDate(isoDate(addDays(parseIsoDate(startDate), 21)))}>{t.next || "Next"} →</button>
          <button onClick={() => window.print()}>{t.print || "Print"}</button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      <div className="print-hourcalc-title"><h1>The Set Helsinki — {t.hourCalc || "HourCalc"}</h1><p>{fmt.format(parseIsoDate(startDate))} – {fmt.format(parseIsoDate(endDate))}</p></div>
      <div className="panel hourcalc-note no-print">
        {t.hourCalcRuleNote || "Evening 18:00–24:00, night 00:00–06:00. S/VL = 7.5 h. Sunday/holiday 100% hours are also shown as a union to avoid double counting. Holidays and eve supplements come from tes_special_days."}
      </div>

      <div className="panel hourcalc-table-wrap">
        {loading ? <p>{t.loading || "Loading…"}</p> : (
          <table className="hourcalc-table">
            <thead><tr>
              <th>{t.employeeName || "Employee"}</th>
              <th>{t.baseHours || "Base"}</th>
              <th>{t.workedHours || "Worked"}</th>
              <th>{t.eveningHours || "Evening"}</th>
              <th>{t.nightHours || "Night"}</th>
              <th>{t.sundayHours || "Sunday"}</th>
              <th>{t.holidayHours || "Holiday"}</th>
              <th>{t.premium100 || "100% total"}</th>
              <th>{t.eveHours || "Aatto"}</th>
              <th>S</th><th>VL</th><th>VV</th><th>V/VP</th>
            </tr></thead>
            <tbody>
              {visibleEmployees.map((employee) => {
                const x = rows.get(employee.id) || emptyTes();
                return <tr key={employee.id}>
                  <td>{employee.name}</td><td>{h(x.base_hours)}</td><td>{h(x.worked_hours)}</td><td>{h(x.evening_hours)}</td><td>{h(x.night_hours)}</td><td>{h(x.sunday_hours)}</td><td>{h(x.holiday_hours)}</td><td><strong>{h(x.premium_100_hours)}</strong></td><td>{h(x.eve_hours)}</td><td>{h(x.sick_hours)}</td><td>{h(x.vacation_hours)}</td><td>{h(x.vv_days)}</td><td>{h(x.unpaid_leave_days)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

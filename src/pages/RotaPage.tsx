import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import {
  addDays,
  displayTime,
  findRotaPeriod,
  getOrCreateRotaPeriod,
  isoDate,
  listRotaShifts,
  mondayOf,
  parseIsoDate,
  saveRotaShift,
  shiftHours,
  type ShiftDraft,
} from "../lib/rota";
import type { Employee, EmployeeRestaurant, Restaurant, RotaPeriod } from "../types/app";

type ShiftMap = Record<string, ShiftDraft>;
const EMPTY_SHIFT: ShiftDraft = { start_time: null, end_time: null, code: "", note: "" };
const CODES = ["", "s", "vl", "vv", "v", "vp"];

function cellKey(employeeId: string, date: string) {
  return `${employeeId}__${date}`;
}

function hoursLabel(value: number) {
  return value ? value.toFixed(2).replace(/\.00$/, "") : "";
}

export function RotaPage() {
  const { profile, language, t } = useApp();
  const canEdit = Boolean(profile && ["super_admin", "admin", "manager"].includes(profile.role));
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeRestaurants, setEmployeeRestaurants] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [startDate, setStartDate] = useState(() => isoDate(mondayOf(new Date())));
  const [period, setPeriod] = useState<RotaPeriod | null>(null);
  const [shifts, setShifts] = useState<ShiftMap>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [restaurantData, employeeData, assignmentData] = await Promise.all([
          listRestaurants(),
          listEmployees(),
          listEmployeeRestaurants(),
        ]);
        const activeRestaurants = restaurantData.filter((r) => r.active);
        setRestaurants(activeRestaurants);
        setEmployees(employeeData.filter((e) => e.active));
        setEmployeeRestaurants(assignmentData);
        if (activeRestaurants.length) setRestaurantId((current) => current || activeRestaurants[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dates = useMemo(() => {
    const first = parseIsoDate(startDate);
    return Array.from({ length: 21 }, (_, index) => isoDate(addDays(first, index)));
  }, [startDate]);

  const restaurantEmployees = useMemo(() => {
    if (!restaurantId) return [];
    const order = new Map(
      employeeRestaurants
        .filter((item) => item.restaurant_id === restaurantId)
        .map((item) => [item.employee_id, item.display_order])
    );
    return employees
      .filter((employee) => order.has(employee.id))
      .sort((a, b) => (order.get(a.id) || 999) - (order.get(b.id) || 999) || a.name.localeCompare(b.name));
  }, [employees, employeeRestaurants, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");
        setDirty(new Set());
        const found = await findRotaPeriod(restaurantId, startDate);
        setPeriod(found);
        if (!found) {
          setShifts({});
          return;
        }
        const rows = await listRotaShifts(found.id);
        const next: ShiftMap = {};
        for (const row of rows) {
          next[cellKey(row.employee_id, row.shift_date)] = {
            start_time: row.start_time ? displayTime(row.start_time) : null,
            end_time: row.end_time ? displayTime(row.end_time) : null,
            code: row.code || "",
            note: row.note || "",
          };
        }
        setShifts(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId, startDate]);

  function updateShift(employeeId: string, date: string, patch: Partial<ShiftDraft>) {
    if (!canEdit) return;
    const key = cellKey(employeeId, date);
    setShifts((current) => ({ ...current, [key]: { ...(current[key] || EMPTY_SHIFT), ...patch } }));
    setDirty((current) => new Set(current).add(key));
    setMessage("");
  }

  async function saveAll() {
    if (!canEdit || !restaurantId || !dirty.size) return;
    try {
      setSaving(true);
      setError("");
      const activePeriod = period || (await getOrCreateRotaPeriod(restaurantId, startDate));
      if (!period) setPeriod(activePeriod);
      const tasks = Array.from(dirty).map((key) => {
        const [employeeId, date] = key.split("__");
        return saveRotaShift(activePeriod, employeeId, date, shifts[key] || EMPTY_SHIFT);
      });
      await Promise.all(tasks);
      setDirty(new Set());
      setMessage(t.rotaSaved || "Rota saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function changeStart(value: string) {
    if (!value) return;
    setStartDate(isoDate(mondayOf(parseIsoDate(value))));
  }

  function moveWeeks(days: number) {
    setStartDate(isoDate(addDays(parseIsoDate(startDate), days)));
  }

  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId);

  if (loading && !restaurants.length) return <div className="panel">{t.loading || "Loading…"}</div>;

  return (
    <div className="rota-page">
      <div className="panel rota-toolbar no-print">
        <div>
          <h2>{t.rota}</h2>
          <p className="muted">{t.rotaDescription || "Three weeks, Monday to Sunday."}</p>
        </div>
        <div className="rota-toolbar-controls">
          <label>
            <span>{t.restaurant || t.restaurants}</span>
            <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.periodStart || "Period start"}</span>
            <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} />
          </label>
          <button className="secondary" onClick={() => moveWeeks(-21)}>← {t.previous || "Previous"}</button>
          <button className="secondary" onClick={() => moveWeeks(21)}>{t.next || "Next"} →</button>
          {canEdit && <button disabled={saving || !dirty.size} onClick={saveAll}>{saving ? (t.saving || "Saving…") : `${t.save || "Save"}${dirty.size ? ` (${dirty.size})` : ""}`}</button>}
          <button onClick={() => window.print()}>{t.print || "Print"}</button>
        </div>
      </div>

      {error && <div className="alert no-print">{error}</div>}
      {message && <div className="notice no-print">{message}</div>}
      {!canEdit && <div className="phase-card no-print">{t.rotaReadOnly || "Read-only rota. Managers and admins can edit shifts."}</div>}

      <div className="print-rota-title">
        <h1>The Set Helsinki — {selectedRestaurant?.name || "Rota"}</h1>
        <p>{new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(parseIsoDate(startDate))} – {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(addDays(parseIsoDate(startDate), 20))}</p>
      </div>

      {restaurantEmployees.length === 0 ? (
        <div className="panel">{t.noRotaEmployees || "No active employees are assigned to this restaurant."}</div>
      ) : (
        <div className="rota-weeks">
          {[0, 1, 2].map((weekIndex) => {
            const weekDates = dates.slice(weekIndex * 7, weekIndex * 7 + 7);
            return (
              <section className="rota-week panel" key={weekIndex}>
                <div className="rota-week-heading">
                  <h3>{t.week || "Week"} {weekIndex + 1}</h3>
                  <span>{weekDates[0]} – {weekDates[6]}</span>
                </div>
                <div className="rota-table-scroll">
                  <table className="rota-table">
                    <thead>
                      <tr>
                        <th className="employee-col">{t.employeeName || "Employee"}</th>
                        {weekDates.map((date) => {
                          const d = parseIsoDate(date);
                          return (
                            <th key={date} className={d.getDay() === 0 ? "sunday" : ""}>
                              <span className="day-name">{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}</span>
                              <span>{new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(d)}</span>
                            </th>
                          );
                        })}
                        <th className="total-col">{t.total || "Total"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurantEmployees.map((employee) => {
                        const weekTotal = weekDates.reduce((sum, date) => sum + shiftHours(shifts[cellKey(employee.id, date)]), 0);
                        return (
                          <tr key={employee.id}>
                            <th className="employee-col employee-name-cell">{employee.name}</th>
                            {weekDates.map((date) => {
                              const key = cellKey(employee.id, date);
                              const shift = shifts[key] || EMPTY_SHIFT;
                              const hours = shiftHours(shift);
                              return (
                                <td key={date} className={dirty.has(key) ? "dirty" : ""}>
                                  <div className="shift-editor no-print">
                                    <div className="shift-time-row">
                                      <input aria-label="Start" type="time" value={shift.start_time || ""} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, { start_time: e.target.value || null })} />
                                      <span>–</span>
                                      <input aria-label="End" type="time" value={shift.end_time || ""} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, { end_time: e.target.value || null })} />
                                    </div>
                                    <div className="shift-meta-row">
                                      <select aria-label="Code" value={shift.code} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, { code: e.target.value })}>
                                        {CODES.map((code) => <option key={code} value={code}>{code ? code.toUpperCase() : (t.code || "Code")}</option>)}
                                      </select>
                                      <input aria-label="Note" type="text" value={shift.note} disabled={!canEdit} placeholder={t.note || "Note"} onChange={(e) => updateShift(employee.id, date, { note: e.target.value })} />
                                    </div>
                                    <small>{hoursLabel(hours)}{hours ? " h" : ""}</small>
                                  </div>
                                  <div className="print-shift">
                                    {shift.start_time && shift.end_time && <strong>{displayTime(shift.start_time)}–{displayTime(shift.end_time)}</strong>}
                                    {shift.code && <span className="print-code">{shift.code.toUpperCase()}</span>}
                                    {shift.note && <span className="print-note">{shift.note}</span>}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="total-col"><strong>{hoursLabel(weekTotal)} h</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

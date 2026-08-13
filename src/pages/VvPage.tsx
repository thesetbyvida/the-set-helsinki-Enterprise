import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import { calculateEmployees, listShiftsForRange } from "../lib/hourcalc";
import { emptyTes } from "../lib/tes";
import { addVvAdjustment, getVvSettings, listVvAdjustments, saveVvSettings, type VvAdjustment, type VvSettings } from "../lib/vv";
import { formatError } from "../lib/errors";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";
import { hoursToNextVv, vvBalance, vvEarned } from "../features/vv/domain";
import { hourBankBalance } from "../features/hourbank/domain";

function n(value: number) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function VvPage() {
  const { profile, language } = useApp();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [settings, setSettings] = useState<VvSettings | null>(null);
  const [worked, setWorked] = useState(new Map<string, ReturnType<typeof emptyTes>>());
  const [adjustments, setAdjustments] = useState<VvAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingSettings, setEditingSettings] = useState(false);
  const [hoursPerVv, setHoursPerVv] = useState(200);
  const [maxVv, setMaxVv] = useState(9);
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const words = language === "fi" ? {
    title: "VV / Vuosivapaa", subtitle: "VV-kertymä, käytetyt päivät ja tuntipankin saldo.", restaurant: "Ravintola", year: "Vuosi",
    employee: "Työntekijä", worked: "Tehdyt tunnit", earned: "Ansaittu VV", used: "Käytetty VV", adjustment: "Korjaus", balance: "Saldo", next: "Seuraava VV", bank: "Tuntipankki", max: "Maksimi saavutettu",
    settings: "VV-asetukset", hoursPer: "Tuntia / VV", yearlyMax: "VV maksimi / vuosi", save: "Tallenna", adjust: "Korjaa", note: "Huomio", vvDelta: "VV muutos", bankDelta: "Tuntipankki muutos", cancel: "Peruuta", loading: "Ladataan…"
  } : language === "es" ? {
    title: "VV / Días libres anuales", subtitle: "Acumulación VV, días utilizados y saldo del banco de horas.", restaurant: "Restaurante", year: "Año",
    employee: "Empleado", worked: "Horas trabajadas", earned: "VV generados", used: "VV usados", adjustment: "Ajuste", balance: "Saldo", next: "Próximo VV", bank: "Banco de horas", max: "Máximo alcanzado",
    settings: "Configuración VV", hoursPer: "Horas / VV", yearlyMax: "Máximo VV / año", save: "Guardar", adjust: "Ajustar", note: "Nota", vvDelta: "Cambio VV", bankDelta: "Cambio banco horas", cancel: "Cancelar", loading: "Cargando…"
  } : {
    title: "VV / Annual free days", subtitle: "VV accrual, used days and hour-bank balance.", restaurant: "Restaurant", year: "Year",
    employee: "Employee", worked: "Worked hours", earned: "VV earned", used: "VV used", adjustment: "Adjustment", balance: "Balance", next: "Next VV", bank: "Hour bank", max: "Maximum reached",
    settings: "VV settings", hoursPer: "Hours / VV", yearlyMax: "Max VV / year", save: "Save", adjust: "Adjust", note: "Note", vvDelta: "VV change", bankDelta: "Hour-bank change", cancel: "Cancel", loading: "Loading…"
  };

  useEffect(() => {
    (async () => {
      try {
        const [r, e, a] = await Promise.all([listRestaurants(), listEmployees(), listEmployeeRestaurants()]);
        const activeRestaurants = r.filter((x) => x.active);
        setRestaurants(activeRestaurants);
        setEmployees(e.filter((x) => x.active));
        setAssignments(a);
        if (activeRestaurants.length) setRestaurantId(activeRestaurants[0].id);
      } catch (e) { setError(formatError(e)); }
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true); setError("");
        const start = `${year}-01-01`; const end = `${year}-12-31`;
        const [s, shifts, adj] = await Promise.all([
          getVvSettings(restaurantId),
          listShiftsForRange(restaurantId, start, end),
          listVvAdjustments(restaurantId, start, end),
        ]);
        setSettings(s); setHoursPerVv(Number(s.hours_per_vv)); setMaxVv(Number(s.max_vv_per_year));
        setWorked(calculateEmployees(shifts, []));
        setAdjustments(adj);
      } catch (e) { setError(formatError(e)); }
      finally { setLoading(false); }
    })();
  }, [restaurantId, year]);

  const visibleEmployees = useMemo(() => {
    const order = new Map(assignments.filter((x) => x.restaurant_id === restaurantId).map((x) => [x.employee_id, x.display_order]));
    return employees.filter((e) => order.has(e.id)).sort((a,b) => (order.get(a.id) || 999) - (order.get(b.id) || 999) || a.name.localeCompare(b.name));
  }, [employees, assignments, restaurantId]);

  const adjustmentsByEmployee = useMemo(() => {
    const m = new Map<string, { vv: number; bank: number }>();
    for (const a of adjustments) {
      const x = m.get(a.employee_id) || { vv: 0, bank: 0 };
      x.vv += Number(a.vv_delta || 0); x.bank += Number(a.bank_hours_delta || 0); m.set(a.employee_id, x);
    }
    return m;
  }, [adjustments]);

  async function reload() {
    if (!restaurantId) return;
    const start = `${year}-01-01`; const end = `${year}-12-31`;
    const [s, shifts, adj] = await Promise.all([getVvSettings(restaurantId), listShiftsForRange(restaurantId, start, end), listVvAdjustments(restaurantId, start, end)]);
    setSettings(s); setWorked(calculateEmployees(shifts, [])); setAdjustments(adj);
  }

  async function saveSettings() {
    try {
      await saveVvSettings(restaurantId, Math.max(1, hoursPerVv), Math.max(0, maxVv));
      setEditingSettings(false); setMessage(words.save); setTimeout(() => setMessage(""), 2200); await reload();
    } catch (e) { setError(formatError(e)); }
  }

  async function adjustEmployee(employee: Employee) {
    const vvRaw = window.prompt(`${words.vvDelta} (${employee.name})`, "0"); if (vvRaw === null) return;
    const bankRaw = window.prompt(`${words.bankDelta} (${employee.name})`, "0"); if (bankRaw === null) return;
    const note = window.prompt(`${words.note} (${employee.name})`, "") ?? "";
    const vvDelta = Number(vvRaw.replace(",", ".")); const bankHoursDelta = Number(bankRaw.replace(",", "."));
    if (!Number.isFinite(vvDelta) || !Number.isFinite(bankHoursDelta)) return;
    try {
      await addVvAdjustment({ employeeId: employee.id, restaurantId, effectiveDate: `${year}-12-31`, vvDelta, bankHoursDelta, note });
      setMessage(words.save); setTimeout(() => setMessage(""), 2200); await reload();
    } catch (e) { setError(formatError(e)); }
  }

  const hpv = Number(settings?.hours_per_vv || 200); const limit = Number(settings?.max_vv_per_year || 9);

  return <div className="vv-page">
    <div className="panel vv-toolbar">
      <div><h2>{words.title}</h2><p className="muted">{words.subtitle}</p></div>
      <div className="vv-controls">
        <label><span>{words.restaurant}</span><select value={restaurantId} onChange={(e)=>setRestaurantId(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>{words.year}</span><select value={year} onChange={(e)=>setYear(Number(e.target.value))}>{[year-2,year-1,year,year+1].map(y=><option key={y}>{y}</option>)}</select></label>
        {isAdmin && <button className="secondary" onClick={()=>setEditingSettings(!editingSettings)}>{words.settings}</button>}
        <button onClick={()=>window.print()}>Print</button>
      </div>
    </div>
    {error && <div className="alert">{error}</div>}{message && <div className="success">{message}</div>}
    {editingSettings && <div className="panel vv-settings no-print"><label>{words.hoursPer}<input type="number" min="1" step="0.5" value={hoursPerVv} onChange={(e)=>setHoursPerVv(Number(e.target.value))}/></label><label>{words.yearlyMax}<input type="number" min="0" max="50" value={maxVv} onChange={(e)=>setMaxVv(Number(e.target.value))}/></label><button onClick={saveSettings}>{words.save}</button></div>}
    <div className="panel vv-summary-note"><strong>{hpv} h = 1 VV</strong> · {words.yearlyMax}: <strong>{limit}</strong>. <span className="muted">VV is calculated from worked shift hours; manual corrections are logged separately.</span></div>
    <div className="panel vv-table-wrap">
      {loading ? <p>{words.loading}</p> : <table className="vv-table"><thead><tr><th>{words.employee}</th><th>{words.worked}</th><th>{words.earned}</th><th>{words.used}</th><th>{words.adjustment}</th><th>{words.balance}</th><th>{words.next}</th><th>{words.bank}</th>{isAdmin && <th className="no-print"></th>}</tr></thead><tbody>
        {visibleEmployees.map(employee => {
          const b = worked.get(employee.id) || emptyTes(); const adj = adjustmentsByEmployee.get(employee.id) || {vv:0,bank:0};
          const earned = vvEarned(b.worked_hours, hpv, limit); const used = b.vv_days; const balance = vvBalance(earned, used, adj.vv);
          const nextHours = hoursToNextVv(b.worked_hours, earned, hpv, limit); const next = nextHours === null ? words.max : `${n(nextHours)} h`;
          const bank = hourBankBalance(employee.bank_hours, adj.bank);
          return <tr key={employee.id}><td><strong>{employee.name}</strong></td><td>{n(b.worked_hours)}</td><td>{earned}</td><td>{n(used)}</td><td>{adj.vv ? (adj.vv>0?"+":"")+n(adj.vv) : "—"}</td><td><strong>{n(balance)}</strong></td><td>{next}</td><td>{n(bank)} h</td>{isAdmin && <td className="no-print"><button className="secondary small" onClick={()=>adjustEmployee(employee)}>{words.adjust}</button></td>}</tr>
        })}
      </tbody></table>}
    </div>
  </div>;
}

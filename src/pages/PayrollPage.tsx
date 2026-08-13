import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import { formatError } from "../lib/errors";
import {
  aggregatePayrollHours, calculateOvertimeByEmployee, calculatePayrollRow, defaultPayrollSettings,
  getPayrollSettings, listPayrollAdjustments, listPayrollShifts, listPayrollSpecialDays, listRotaPeriodsForRange,
  movePayrollPeriod, payrollPeriodForDate, savePayrollSettings, type PayrollRow, type PayrollSettings,
} from "../lib/payroll";
import { parseIsoDate } from "../lib/rota";
import { emptyTes } from "../lib/tes";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";

const h = (v:number) => v.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
const eur = (v:number, locale:string) => new Intl.NumberFormat(locale,{style:"currency",currency:"EUR"}).format(v);

export function PayrollPage(){
  const { language, profile, t } = useApp();
  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";
  const [restaurants,setRestaurants]=useState<Restaurant[]>([]), [employees,setEmployees]=useState<Employee[]>([]), [assignments,setAssignments]=useState<EmployeeRestaurant[]>([]);
  const [restaurantId,setRestaurantId]=useState("");
  const [settings,setSettings]=useState<PayrollSettings>(defaultPayrollSettings(""));
  const [period,setPeriod]=useState(()=>payrollPeriodForDate(new Date(),21));
  const [anchorDate,setAnchorDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState<PayrollRow[]>([]), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false);
  const [error,setError]=useState(""), [notice,setNotice]=useState("");
  const canEdit = profile?.role === "admin" || profile?.role === "super_admin";

  useEffect(()=>{(async()=>{try{const [r,e,a]=await Promise.all([listRestaurants(),listEmployees(),listEmployeeRestaurants()]);const active=r.filter(x=>x.active);setRestaurants(active);setEmployees(e.filter(x=>x.active));setAssignments(a);if(active.length)setRestaurantId(active[0].id)}catch(e){setError(formatError(e))}})()},[]);
  useEffect(()=>{if(!restaurantId)return;(async()=>{try{const s=await getPayrollSettings(restaurantId);setSettings(s);setPeriod(payrollPeriodForDate(parseIsoDate(anchorDate),s.period_start_day||21))}catch(e){setError(formatError(e))}})()},[restaurantId]);

  const visibleEmployees=useMemo(()=>{const order=new Map(assignments.filter(x=>x.restaurant_id===restaurantId).map(x=>[x.employee_id,x.display_order]));return employees.filter(e=>order.has(e.id)).sort((a,b)=>(order.get(a.id)||999)-(order.get(b.id)||999)||a.name.localeCompare(b.name))},[assignments,employees,restaurantId]);

  useEffect(()=>{if(!restaurantId)return;(async()=>{try{setLoading(true);setError("");const [shifts,specialDays,periods,adjustments]=await Promise.all([
    listPayrollShifts(restaurantId,period.start,period.end),listPayrollSpecialDays(period.start,period.end),listRotaPeriodsForRange(restaurantId,period.start,period.end),listPayrollAdjustments(restaurantId,period.start,period.end)
  ]);const byEmp=aggregatePayrollHours(shifts,specialDays);const ot=calculateOvertimeByEmployee(visibleEmployees,shifts,periods,specialDays);const adj=new Map<string,number>();for(const a of adjustments)adj.set(a.employee_id,(adj.get(a.employee_id)||0)+Number(a.amount||0));setRows(visibleEmployees.map(e=>calculatePayrollRow(e,byEmp.get(e.id)||emptyTes(),settings,ot.get(e.id),adj.get(e.id)||0)))}catch(e){setError(formatError(e))}finally{setLoading(false)}})()},[restaurantId,period.start,period.end,visibleEmployees,settings]);

  const fmt=new Intl.DateTimeFormat(locale,{day:"2-digit",month:"2-digit",year:"numeric"});
  const restaurantName=restaurants.find(r=>r.id===restaurantId)?.name||"";
  const totals=useMemo(()=>rows.reduce((a,r)=>({hours:a.hours+r.hours.base_hours,worked:a.worked+r.hours.worked_hours,ot:a.ot+r.overtime_hours,bank:a.bank+r.bank_delta,base:a.base+r.base_pay,evening:a.evening+r.evening_pay,night:a.night+r.night_pay,premium:a.premium+r.premium_100_pay,eve:a.eve+r.eve_pay,otpay:a.otpay+r.overtime_pay,adj:a.adj+r.adjustments_pay,gross:a.gross+r.gross_pay}),{hours:0,worked:0,ot:0,bank:0,base:0,evening:0,night:0,premium:0,eve:0,otpay:0,adj:0,gross:0}),[rows]);

  async function saveRates(){try{setSaving(true);setError("");setNotice("");await savePayrollSettings(settings);setNotice(language==="fi"?"Palkanlaskennan asetukset tallennettu.":language==="es"?"Configuración de nómina guardada.":"Payroll settings saved.")}catch(e){setError(formatError(e))}finally{setSaving(false)}}
  function changeStartDay(raw:number){const value=Math.min(28,Math.max(1,raw||21));setSettings(s=>({...s,period_start_day:value}));setPeriod(payrollPeriodForDate(parseIsoDate(anchorDate),value))}
  function chooseDate(value:string){setAnchorDate(value);if(value)setPeriod(payrollPeriodForDate(parseIsoDate(value),settings.period_start_day))}

  return <div className="payroll-page">
    <div className="panel payroll-toolbar no-print"><div><h2>{t.payroll}</h2><p className="muted">Payroll PRO · 21–20 · TES breakdown · overtime · hour bank</p></div><div className="payroll-controls">
      <label><span>{t.restaurant||"Restaurant"}</span><select value={restaurantId} onChange={e=>setRestaurantId(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label><span>{language==="fi"?"Valitse kuukausi/päivä":language==="es"?"Seleccionar fecha":"Select date"}</span><input type="date" value={anchorDate} onChange={e=>chooseDate(e.target.value)}/></label>
      <label><span>{t.payrollPeriod||"Payroll period"}</span><input value={`${period.start} – ${period.end}`} readOnly/></label>
      <button className="secondary" onClick={()=>setPeriod(movePayrollPeriod(period,-1,settings.period_start_day))}>← {t.previous||"Previous"}</button><button className="secondary" onClick={()=>setPeriod(movePayrollPeriod(period,1,settings.period_start_day))}>{t.next||"Next"} →</button><button className="secondary" onClick={()=>chooseDate(new Date().toISOString().slice(0,10))}>{language==="fi"?"Nykyinen":language==="es"?"Actual":"Current"}</button><button onClick={()=>window.print()}>{t.print||"Print"}</button>
    </div></div>
    {error&&<div className="alert">{error}</div>}{notice&&<div className="notice">{notice}</div>}

    <div className="payroll-kpis no-print">
      <div className="panel payroll-kpi"><span>Paid hours</span><strong>{h(totals.hours)} h</strong></div><div className="panel payroll-kpi"><span>Worked</span><strong>{h(totals.worked)} h</strong></div><div className="panel payroll-kpi"><span>Overtime</span><strong>{h(totals.ot)} h</strong></div><div className="panel payroll-kpi"><span>Bank Δ</span><strong>{totals.bank>=0?"+":""}{h(totals.bank)} h</strong></div><div className="panel payroll-kpi"><span>Labour cost</span><strong>{eur(totals.gross,locale)}</strong></div>
    </div>

    <div className="panel payroll-rates no-print"><div><h3>{t.payrollRates||"Payroll rates"}</h3><p className="muted">Enter only your official current company/TES supplements. Overtime €/h is an extra supplement; base worked hours are already paid.</p></div><div className="payroll-rate-grid">
      <label><span>{t.periodStartDay||"Period starts on day"}</span><input type="number" min="1" max="28" disabled={!canEdit} value={settings.period_start_day} onChange={e=>changeStartDay(Number(e.target.value))}/></label>
      <label><span>{t.eveningRate||"Evening €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEdit} value={settings.evening_eur_per_hour} onChange={e=>setSettings({...settings,evening_eur_per_hour:Number(e.target.value)})}/></label>
      <label><span>{t.nightRate||"Night €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEdit} value={settings.night_eur_per_hour} onChange={e=>setSettings({...settings,night_eur_per_hour:Number(e.target.value)})}/></label>
      <label><span>{t.eveRate||"Aatto €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEdit} value={settings.eve_eur_per_hour} onChange={e=>setSettings({...settings,eve_eur_per_hour:Number(e.target.value)})}/></label>
      <label><span>Overtime extra €/h</span><input type="number" min="0" step="0.01" disabled={!canEdit} value={settings.overtime_eur_per_hour} onChange={e=>setSettings({...settings,overtime_eur_per_hour:Number(e.target.value)})}/></label>
      {canEdit&&<button onClick={saveRates} disabled={saving}>{saving?(t.saving||"Saving…"):(t.save||"Save")}</button>}
    </div></div>

    <div className="print-payroll-title"><h1>The Set Helsinki — {t.payroll}</h1><p>{restaurantName} · {fmt.format(parseIsoDate(period.start))} – {fmt.format(parseIsoDate(period.end))}</p></div>
    <div className="panel payroll-table-wrap">{loading?<p>{t.loading||"Loading…"}</p>:<table className="payroll-table"><thead><tr>
      <th>{t.employeeName||"Employee"}</th><th>{t.contractType||"Contract"}</th><th>€/h</th><th>Worked h</th><th>Paid base h</th><th>Evening</th><th>Night</th><th>Sunday</th><th>Holiday</th><th>100%</th><th>Aatto</th><th>S</th><th>VL</th><th>VV</th><th>OT h</th><th>Bank Δ</th><th>Bank</th><th>Base €</th><th>Evening €</th><th>Night €</th><th>100% €</th><th>Aatto €</th><th>OT €</th><th>Adjust.</th><th>Total €</th>
    </tr></thead><tbody>{rows.map(r=><tr key={r.employee.id}><td className="sticky-payroll-name">{r.employee.name}</td><td>{r.employee.contract_type}</td><td>{eur(Number(r.employee.hourly_rate||0),locale)}</td><td>{h(r.hours.worked_hours)}</td><td>{h(r.hours.base_hours)}</td><td>{h(r.hours.evening_hours)}</td><td>{h(r.hours.night_hours)}</td><td>{h(r.hours.sunday_hours)}</td><td>{h(r.hours.holiday_hours)}</td><td>{h(r.hours.premium_100_hours)}</td><td>{h(r.hours.eve_hours)}</td><td>{h(r.hours.sick_hours)}</td><td>{h(r.hours.vacation_hours)}</td><td>{h(r.hours.vv_days)}</td><td><strong>{h(r.overtime_hours)}</strong></td><td>{r.bank_delta>=0?"+":""}{h(r.bank_delta)}</td><td>{h(r.bank_balance)}</td><td>{eur(r.base_pay,locale)}</td><td>{eur(r.evening_pay,locale)}</td><td>{eur(r.night_pay,locale)}</td><td>{eur(r.premium_100_pay,locale)}</td><td>{eur(r.eve_pay,locale)}</td><td>{eur(r.overtime_pay,locale)}</td><td>{eur(r.adjustments_pay,locale)}</td><td><strong>{eur(r.gross_pay,locale)}</strong></td></tr>)}</tbody>
    <tfoot><tr><td colSpan={3}>Total</td><td>{h(totals.worked)}</td><td>{h(totals.hours)}</td><td colSpan={9}></td><td>{h(totals.ot)}</td><td>{totals.bank>=0?"+":""}{h(totals.bank)}</td><td></td><td>{eur(totals.base,locale)}</td><td>{eur(totals.evening,locale)}</td><td>{eur(totals.night,locale)}</td><td>{eur(totals.premium,locale)}</td><td>{eur(totals.eve,locale)}</td><td>{eur(totals.otpay,locale)}</td><td>{eur(totals.adj,locale)}</td><td><strong>{eur(totals.gross,locale)}</strong></td></tr></tfoot></table>}</div>
    <div className="panel payroll-footnote no-print">Base h = worked + paid S + VL. VV is tracked separately. Sunday/holiday uses a non-duplicated 100% premium. Overtime is calculated against each full 3-week rota period; 0-hour contracts do not generate threshold overtime automatically.</div>
  </div>
}

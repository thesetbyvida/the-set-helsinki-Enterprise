import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees } from "../lib/employees";
import { formatError } from "../lib/errors";
import {
  aggregatePayrollHours,
  calculateOvertimeByEmployee,
  calculatePayrollRow,
  closePayrollPeriod,
  defaultPayrollSettings,
  getPayrollPeriodRecord,
  getPayrollSettings,
  listPayrollAdjustments,
  listPayrollPeriodRecords,
  listPayrollShifts,
  listPayrollSpecialDays,
  listRotaPeriodsForRange,
  movePayrollPeriod,
  payrollPeriodForDate,
  reopenPayrollPeriod,
  savePayrollSettings,
  type PayrollPeriod,
  type PayrollPeriodRecord,
  type PayrollRow,
  type PayrollSettings,
} from "../lib/payroll";
import { parseIsoDate } from "../lib/rota";
import { emptyTes } from "../lib/tes";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";
import { runPayrollSelfTests, validatePayrollConfiguration } from "../lib/payrollValidation";

const h = (v:number) => Number(v || 0).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
const eur = (v:number, locale:string) => new Intl.NumberFormat(locale,{style:"currency",currency:"EUR"}).format(Number(v || 0));

type PayrollTotals = {
  hours:number; worked:number; additional:number; ot50:number; ot100:number; ot:number; bank:number;
  base:number; extraBase:number; evening:number; night:number; premium:number; eve:number; otpay:number; adj:number; gross:number;
};

const emptyTotals = (): PayrollTotals => ({
  hours:0,worked:0,additional:0,ot50:0,ot100:0,ot:0,bank:0,
  base:0,extraBase:0,evening:0,night:0,premium:0,eve:0,otpay:0,adj:0,gross:0,
});

function csvCell(value: unknown) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadText(content:string, filename:string){
  const blob=new Blob([content],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

export function PayrollPage(){
  const { language, profile, t } = useApp();
  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";
  const [restaurants,setRestaurants]=useState<Restaurant[]>([]), [employees,setEmployees]=useState<Employee[]>([]), [assignments,setAssignments]=useState<EmployeeRestaurant[]>([]);
  const [restaurantId,setRestaurantId]=useState("");
  const [settings,setSettings]=useState<PayrollSettings>(defaultPayrollSettings(""));
  const [period,setPeriod]=useState<PayrollPeriod>(()=>payrollPeriodForDate(new Date(),21));
  const [anchorDate,setAnchorDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState<PayrollRow[]>([]), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false);
  const [periodRecord,setPeriodRecord]=useState<PayrollPeriodRecord|null>(null);
  const [periodRecords,setPeriodRecords]=useState<PayrollPeriodRecord[]>([]);
  const [closing,setClosing]=useState(false), [refreshKey,setRefreshKey]=useState(0);
  const [error,setError]=useState(""), [notice,setNotice]=useState("");
  const canEdit = profile?.role === "admin" || profile?.role === "super_admin";
  const isClosed = periodRecord?.status === "closed";
  const selfTests = useMemo(() => runPayrollSelfTests(), []);
  const selfTestsPassed = selfTests.every(x => x.passed);
  const validationIssues = useMemo(() => validatePayrollConfiguration(rows, settings), [rows, settings]);
  const validationErrors = validationIssues.filter(x => x.severity === "error");
  const validationWarnings = validationIssues.filter(x => x.severity === "warning");

  useEffect(()=>{(async()=>{try{const [r,e,a]=await Promise.all([listRestaurants(),listEmployees(),listEmployeeRestaurants()]);const active=r.filter(x=>x.active);setRestaurants(active);setEmployees(e.filter(x=>x.active));setAssignments(a);if(active.length)setRestaurantId(active[0].id)}catch(e){setError(formatError(e))}})()},[]);

  useEffect(()=>{if(!restaurantId)return;(async()=>{try{
    const [s,history]=await Promise.all([getPayrollSettings(restaurantId),listPayrollPeriodRecords(restaurantId)]);
    setSettings(s);setPeriodRecords(history);setPeriod(payrollPeriodForDate(parseIsoDate(anchorDate),s.period_start_day||21));
  }catch(e){setError(formatError(e))}})()},[restaurantId,refreshKey]);

  const visibleEmployees=useMemo(()=>{const order=new Map(assignments.filter(x=>x.restaurant_id===restaurantId).map(x=>[x.employee_id,x.display_order]));return employees.filter(e=>order.has(e.id)).sort((a,b)=>(order.get(a.id)||999)-(order.get(b.id)||999)||a.name.localeCompare(b.name))},[assignments,employees,restaurantId]);

  useEffect(()=>{if(!restaurantId)return;(async()=>{try{
    setLoading(true);setError("");
    const record=await getPayrollPeriodRecord(restaurantId,period.start,period.end);
    setPeriodRecord(record);
    if(record?.status==="closed" && Array.isArray(record.rows_snapshot)){
      setRows(record.rows_snapshot as PayrollRow[]);
      return;
    }
    const [shifts,specialDays,periods,adjustments]=await Promise.all([
      listPayrollShifts(restaurantId,period.start,period.end),listPayrollSpecialDays(period.start,period.end),listRotaPeriodsForRange(restaurantId,period.start,period.end),listPayrollAdjustments(restaurantId,period.start,period.end)
    ]);
    const completedPeriods=periods.filter(p=>p.end_date>=period.start&&p.end_date<=period.end);
    let overtimeShifts=shifts, overtimeSpecialDays=specialDays;
    if(completedPeriods.length){const otStart=completedPeriods.reduce((m,p)=>p.start_date<m?p.start_date:m,completedPeriods[0].start_date);const otEnd=completedPeriods.reduce((m,p)=>p.end_date>m?p.end_date:m,completedPeriods[0].end_date);[overtimeShifts,overtimeSpecialDays]=await Promise.all([listPayrollShifts(restaurantId,otStart,otEnd),listPayrollSpecialDays(otStart,otEnd)]);}
    const byEmp=aggregatePayrollHours(shifts,specialDays);const ot=calculateOvertimeByEmployee(visibleEmployees,overtimeShifts,completedPeriods,overtimeSpecialDays);const adj=new Map<string,number>();for(const a of adjustments)adj.set(a.employee_id,(adj.get(a.employee_id)||0)+Number(a.amount||0));
    setRows(visibleEmployees.map(e=>calculatePayrollRow(e,byEmp.get(e.id)||emptyTes(),settings,ot.get(e.id),adj.get(e.id)||0)));
  }catch(e){setError(formatError(e))}finally{setLoading(false)}})()},[restaurantId,period.start,period.end,visibleEmployees,settings,refreshKey]);

  const fmt=new Intl.DateTimeFormat(locale,{day:"2-digit",month:"2-digit",year:"numeric"});
  const restaurantName=restaurants.find(r=>r.id===restaurantId)?.name||"";
  const totals=useMemo<PayrollTotals>(()=>rows.reduce((a,r)=>({hours:a.hours+r.hours.base_hours,worked:a.worked+r.hours.worked_hours,additional:a.additional+r.additional_work_hours,ot50:a.ot50+r.overtime_50_hours,ot100:a.ot100+r.overtime_100_hours,ot:a.ot+r.overtime_hours,bank:a.bank+r.bank_delta,base:a.base+r.base_pay,extraBase:a.extraBase+r.extra_work_base_pay,evening:a.evening+r.evening_pay,night:a.night+r.night_pay,premium:a.premium+r.premium_100_pay,eve:a.eve+r.eve_pay,otpay:a.otpay+r.overtime_pay,adj:a.adj+r.adjustments_pay,gross:a.gross+r.gross_pay}),emptyTotals()),[rows]);

  const periodOptions=useMemo(()=>{
    const current=payrollPeriodForDate(new Date(),settings.period_start_day||21);
    const options:PayrollPeriod[]=[];
    for(let i=-24;i<=12;i++)options.push(movePayrollPeriod(current,i,settings.period_start_day||21));
    if(!options.some(x=>x.start===period.start))options.push(period);
    return options.sort((a,b)=>b.start.localeCompare(a.start));
  },[settings.period_start_day,period.start,period.end]);
  const closedStarts=useMemo(()=>new Set(periodRecords.filter(x=>x.status==="closed").map(x=>x.period_start)),[periodRecords]);

  async function saveRates(){try{setSaving(true);setError("");setNotice("");await savePayrollSettings(settings);setNotice(language==="fi"?"Palkanlaskennan asetukset tallennettu.":language==="es"?"Configuración de nómina guardada.":"Payroll settings saved.")}catch(e){setError(formatError(e))}finally{setSaving(false)}}
  function changeStartDay(raw:number){const value=Math.min(28,Math.max(1,raw||21));setSettings(s=>({...s,period_start_day:value}));setPeriod(payrollPeriodForDate(parseIsoDate(anchorDate),value))}
  function chooseDate(value:string){setAnchorDate(value);if(value)setPeriod(payrollPeriodForDate(parseIsoDate(value),settings.period_start_day))}
  function choosePeriod(start:string){const next=periodOptions.find(x=>x.start===start);if(next){setPeriod(next);setAnchorDate(next.start)}}

  async function closeCurrentPeriod(){
    if(!canEdit||loading||!restaurantId)return;
    if(!selfTestsPassed || validationErrors.length){
      setError(language === "fi" ? "Palkkakautta ei voi sulkea ennen kuin Payroll Validation -virheet on korjattu." : language === "es" ? "No se puede cerrar el periodo hasta corregir los errores de Payroll Validation." : "The payroll period cannot be closed until Payroll Validation errors are fixed.");
      return;
    }
    const message=language==="fi"?"Suljetaanko tämä palkkakausi? Sulkeminen lukitsee rota- ja palkkamuutokset tältä ajalta.":language==="es"?"¿Cerrar este periodo de nómina? Al cerrarlo se bloquearán los cambios del rota y de nómina dentro de estas fechas.":"Close this payroll period? Closing it locks rota and payroll changes inside these dates.";
    if(!window.confirm(message))return;
    try{setClosing(true);setError("");setNotice("");const rec=await closePayrollPeriod({restaurantId,start:period.start,end:period.end,rows,totals:{...totals},settings,userId:profile?.id});setPeriodRecord(rec);setPeriodRecords(await listPayrollPeriodRecords(restaurantId));setNotice(language==="fi"?"Palkkakausi suljettu ja historiallinen tilannekuva tallennettu.":language==="es"?"Periodo cerrado y copia histórica guardada.":"Payroll period closed and historical snapshot saved.")}catch(e){setError(formatError(e))}finally{setClosing(false)}
  }

  async function reopenCurrentPeriod(){
    if(!canEdit||!restaurantId)return;
    const message=language==="fi"?"Avataanko palkkakausi uudelleen? Rota- ja palkkamuutokset sallitaan jälleen.":language==="es"?"¿Reabrir este periodo? Los cambios de rota y nómina volverán a estar permitidos.":"Reopen this payroll period? Rota and payroll changes will be allowed again.";
    if(!window.confirm(message))return;
    try{setClosing(true);setError("");setNotice("");await reopenPayrollPeriod({restaurantId,start:period.start,end:period.end,userId:profile?.id});setNotice(language==="fi"?"Palkkakausi avattu uudelleen.":language==="es"?"Periodo reabierto.":"Payroll period reopened.");setRefreshKey(x=>x+1)}catch(e){setError(formatError(e))}finally{setClosing(false)}
  }

  function exportCsv(){
    const headers=["Employee","Contract","Pay basis","Ref EUR/h","Monthly EUR","Worked h","Paid base h","Evening h","Night h","Sunday h","Holiday h","100% h","Aatto h","S h","VL h","VV","Additional h","OT 50 h","OT 100 h","Bank delta","Bank","Base EUR","Extra base EUR","Evening EUR","Night EUR","100% EUR","Aatto EUR","OT EUR","Adjustments EUR","Gross EUR"];
    const body=rows.map(r=>[r.employee.name,r.employee.contract_type,r.pay_basis,r.reference_hourly_rate,r.monthly_salary,r.hours.worked_hours,r.hours.base_hours,r.hours.evening_hours,r.hours.night_hours,r.hours.sunday_hours,r.hours.holiday_hours,r.hours.premium_100_hours,r.hours.eve_hours,r.hours.sick_hours,r.hours.vacation_hours,r.hours.vv_days,r.additional_work_hours,r.overtime_50_hours,r.overtime_100_hours,r.bank_delta,r.bank_balance,r.base_pay,r.extra_work_base_pay,r.evening_pay,r.night_pay,r.premium_100_pay,r.eve_pay,r.overtime_pay,r.adjustments_pay,r.gross_pay]);
    const meta=[["The Set Helsinki Enterprise"],[restaurantName],[`${period.start} - ${period.end}`],[isClosed?"CLOSED SNAPSHOT":"OPEN / LIVE"],[]];
    const csv=[...meta,headers,...body].map(row=>row.map(csvCell).join(";")).join("\n");
    const safe=restaurantName.replace(/[^a-z0-9-_]+/gi,"-")||"restaurant";
    downloadText("\ufeff"+csv,`payroll-${safe}-${period.start}-${period.end}.csv`);
  }

  return <div className="payroll-page">
    <div className="panel payroll-toolbar no-print"><div><h2>{t.payroll}</h2><p className="muted">Payroll PRO · Phase 5.2 validation · monthly/hourly safeguards · TES regression checks</p></div><div className="payroll-controls">
      <label><span>{t.restaurant||"Restaurant"}</span><select value={restaurantId} onChange={e=>setRestaurantId(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label><span>{language==="fi"?"Palkkakausihistoria":language==="es"?"Historial de periodos":"Period history"}</span><select value={period.start} onChange={e=>choosePeriod(e.target.value)}>{periodOptions.map(p=><option key={p.start} value={p.start}>{closedStarts.has(p.start)?"🔒 ":""}{p.start} → {p.end}</option>)}</select></label>
      <label><span>{language==="fi"?"Valitse päivä":language==="es"?"Seleccionar fecha":"Select date"}</span><input type="date" value={anchorDate} onChange={e=>chooseDate(e.target.value)}/></label>
      <button className="secondary" onClick={()=>{const p=movePayrollPeriod(period,-1,settings.period_start_day);setPeriod(p);setAnchorDate(p.start)}}>← {t.previous||"Previous"}</button>
      <button className="secondary" onClick={()=>{const p=movePayrollPeriod(period,1,settings.period_start_day);setPeriod(p);setAnchorDate(p.start)}}>{t.next||"Next"} →</button>
      <button className="secondary" onClick={()=>chooseDate(new Date().toISOString().slice(0,10))}>{language==="fi"?"Nykyinen":language==="es"?"Actual":"Current"}</button>
      <button className="secondary" onClick={exportCsv}>CSV</button><button onClick={()=>window.print()}>{t.print||"Print / PDF"}</button>
    </div></div>
    {error&&<div className="alert">{error}</div>}{notice&&<div className="notice">{notice}</div>}

    <div className={`panel payroll-period-status no-print ${isClosed?"is-closed":"is-open"}`}>
      <div><span className={`status-pill ${isClosed?"status-closed":"status-open"}`}>{isClosed?"🔒 CLOSED":"● OPEN"}</span><strong>{period.start} → {period.end}</strong><small>{isClosed?(language==="fi"?"Historiallinen tilannekuva — rota ja palkkamuutokset lukittu.":language==="es"?"Copia histórica — rota y cambios de nómina bloqueados.":"Historical snapshot — rota and payroll changes are locked."):(language==="fi"?"Live-laskenta — muutokset ovat vielä sallittuja.":language==="es"?"Cálculo en vivo — todavía se permiten cambios.":"Live calculation — changes are still allowed.")}</small></div>
      {canEdit && (!isClosed?<button onClick={closeCurrentPeriod} disabled={closing||loading}>{closing?"…":language==="fi"?"Sulje kausi":language==="es"?"Cerrar periodo":"Close period"}</button>:<button className="secondary" onClick={reopenCurrentPeriod} disabled={closing}>{closing?"…":language==="fi"?"Avaa uudelleen":language==="es"?"Reabrir periodo":"Reopen period"}</button>)}
    </div>

    <div className={`panel payroll-validation no-print ${selfTestsPassed && validationErrors.length===0 ? "validation-ok" : "validation-problem"}`}>
      <div className="payroll-validation-head">
        <div><h3>Payroll Validation</h3><p className="muted">Automatic checks before a payroll period can be closed.</p></div>
        <span className={`status-pill ${selfTestsPassed && validationErrors.length===0 ? "status-open" : "status-closed"}`}>{selfTestsPassed && validationErrors.length===0 ? "✓ READY" : "⚠ CHECK"}</span>
      </div>
      <div className="payroll-validation-summary">
        <strong>{selfTests.filter(x=>x.passed).length}/{selfTests.length}</strong> regression tests passed · <strong>{validationErrors.length}</strong> errors · <strong>{validationWarnings.length}</strong> warnings
      </div>
      {(!selfTestsPassed || validationIssues.length>0) && <details>
        <summary>{language === "fi" ? "Näytä tarkistukset" : language === "es" ? "Ver comprobaciones" : "Show checks"}</summary>
        <div className="payroll-validation-list">
          {selfTests.filter(x=>!x.passed).map(x=><div key={x.name} className="validation-item error"><strong>ERROR · {x.name}</strong><span>{x.detail}</span></div>)}
          {validationIssues.map((x,i)=><div key={`${x.code}-${x.employeeId||i}`} className={`validation-item ${x.severity}`}><strong>{x.severity.toUpperCase()} · {x.code}</strong><span>{x.message}</span></div>)}
        </div>
      </details>}
      {selfTestsPassed && validationIssues.length===0 && <p className="validation-clean">✓ Shift splitting, codes, monthly salary basis and hourly base-pay tests passed. No payroll configuration problems detected.</p>}
    </div>

    <div className="payroll-kpis no-print">
      <div className="panel payroll-kpi"><span>Paid hours</span><strong>{h(totals.hours)} h</strong></div><div className="panel payroll-kpi"><span>Worked</span><strong>{h(totals.worked)} h</strong></div><div className="panel payroll-kpi"><span>Additional</span><strong>{h(totals.additional)} h</strong></div><div className="panel payroll-kpi"><span>OT 50 / 100</span><strong>{h(totals.ot50)} / {h(totals.ot100)} h</strong></div><div className="panel payroll-kpi"><span>Bank Δ</span><strong>{totals.bank>=0?"+":""}{h(totals.bank)} h</strong></div><div className="panel payroll-kpi"><span>Labour cost</span><strong>{eur(totals.gross,locale)}</strong></div>
    </div>

    <div className="panel payroll-rates no-print"><div><h3>{t.payrollRates||"Payroll rates"}</h3><p className="muted">Phase 5.2 validates payroll before closing. Monthly employees always use monthly salary ÷ 159 as their reference hourly rate; stale hourly-rate values no longer override the monthly basis.</p></div><div className="payroll-rate-grid">
      <label><span>{t.periodStartDay||"Period starts on day"}</span><input type="number" min="1" max="28" disabled={!canEdit||isClosed} value={settings.period_start_day} onChange={e=>changeStartDay(Number(e.target.value))}/></label>
      <label><span>{t.eveningRate||"Evening €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEdit||isClosed} value={settings.evening_eur_per_hour} onChange={e=>setSettings({...settings,evening_eur_per_hour:Number(e.target.value)})}/></label>
      <label><span>{t.nightRate||"Night €/h"}</span><input type="number" min="0" step="0.01" disabled={!canEdit||isClosed} value={settings.night_eur_per_hour} onChange={e=>setSettings({...settings,night_eur_per_hour:Number(e.target.value)})}/></label>
      <div className="payroll-rule-chip"><span>Aatto</span><strong>+50%</strong></div><div className="payroll-rule-chip"><span>Overtime</span><strong>120h → 18h +50%, then +100%</strong></div>
      {canEdit&&!isClosed&&<button onClick={saveRates} disabled={saving}>{saving?(t.saving||"Saving…"):(t.save||"Save")}</button>}
    </div></div>

    <div className="print-payroll-title"><h1>The Set Helsinki — {t.payroll}</h1><p>{restaurantName} · {fmt.format(parseIsoDate(period.start))} – {fmt.format(parseIsoDate(period.end))} · {isClosed?"CLOSED":"OPEN"}</p></div>
    <div className="panel payroll-table-wrap">{loading?<p>{t.loading||"Loading…"}</p>:<table className="payroll-table"><thead><tr>
      <th>{t.employeeName||"Employee"}</th><th>{t.contractType||"Contract"}</th><th>Pay basis</th><th>Ref. €/h</th><th>Monthly €</th><th>Worked h</th><th>Paid base h</th><th>Evening</th><th>Night</th><th>Sunday</th><th>Holiday</th><th>100%</th><th>Aatto</th><th>S</th><th>VL</th><th>VV</th><th>Additional</th><th>OT 50</th><th>OT 100</th><th>Bank Δ</th><th>Bank</th><th>Base €</th><th>Extra base €</th><th>Evening €</th><th>Night €</th><th>100% €</th><th>Aatto €</th><th>OT €</th><th>Adjust.</th><th>Total €</th>
    </tr></thead><tbody>{rows.map(r=><tr key={r.employee.id}><td className="sticky-payroll-name">{r.employee.name}</td><td>{r.employee.contract_type}</td><td><strong>{r.pay_basis === "monthly" ? (language === "fi" ? "Kuukausi" : language === "es" ? "Mensual" : "Monthly") : (language === "fi" ? "Tunti" : language === "es" ? "Por hora" : "Hourly")}</strong></td><td>{eur(r.reference_hourly_rate,locale)}</td><td>{r.pay_basis === "monthly" ? eur(r.monthly_salary,locale) : "—"}</td><td>{h(r.hours.worked_hours)}</td><td>{h(r.hours.base_hours)}</td><td>{h(r.hours.evening_hours)}</td><td>{h(r.hours.night_hours)}</td><td>{h(r.hours.sunday_hours)}</td><td>{h(r.hours.holiday_hours)}</td><td>{h(r.hours.premium_100_hours)}</td><td>{h(r.hours.eve_hours)}</td><td>{h(r.hours.sick_hours)}</td><td>{h(r.hours.vacation_hours)}</td><td>{h(r.hours.vv_days)}</td><td>{h(r.additional_work_hours)}</td><td><strong>{h(r.overtime_50_hours)}</strong></td><td><strong>{h(r.overtime_100_hours)}</strong></td><td>{r.bank_delta>=0?"+":""}{h(r.bank_delta)}</td><td>{h(r.bank_balance)}</td><td>{eur(r.base_pay,locale)}</td><td>{eur(r.extra_work_base_pay,locale)}</td><td>{eur(r.evening_pay,locale)}</td><td>{eur(r.night_pay,locale)}</td><td>{eur(r.premium_100_pay,locale)}</td><td>{eur(r.eve_pay,locale)}</td><td>{eur(r.overtime_pay,locale)}</td><td>{eur(r.adjustments_pay,locale)}</td><td><strong>{eur(r.gross_pay,locale)}</strong></td></tr>)}</tbody>
    <tfoot><tr><td colSpan={5}>Total</td><td>{h(totals.worked)}</td><td>{h(totals.hours)}</td><td colSpan={9}></td><td>{h(totals.additional)}</td><td>{h(totals.ot50)}</td><td>{h(totals.ot100)}</td><td>{totals.bank>=0?"+":""}{h(totals.bank)}</td><td></td><td>{eur(totals.base,locale)}</td><td>{eur(totals.extraBase,locale)}</td><td>{eur(totals.evening,locale)}</td><td>{eur(totals.night,locale)}</td><td>{eur(totals.premium,locale)}</td><td>{eur(totals.eve,locale)}</td><td>{eur(totals.otpay,locale)}</td><td>{eur(totals.adj,locale)}</td><td><strong>{eur(totals.gross,locale)}</strong></td></tr></tfoot></table>}</div>
    <div className="panel payroll-footnote no-print">Phase 5.2: Payroll Validation runs deterministic regression checks and employee/rate checks. A payroll period with validation errors cannot be closed. Historical locking, CSV and Print/PDF remain unchanged.</div>
  </div>
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { addTes, calculateShiftTes, emptyTes, type SpecialDay, type TesBreakdown } from "../lib/tes";
import { vvBalance, vvEarned } from "../features/vv/domain";

type Shift = { id:string; shift_date:string; shift_slot?:number|null; start_time:string|null; end_time:string|null; code:string|null; note?:string|null; restaurant_id?:string|null; restaurant_name?:string|null };
type Profile = { id:string; full_name:string|null; email:string|null; role:string|null };
type Employee = { id:string; name:string; email:string|null; bank_hours?:number|null; contract_hours?:number|null };
type RequestSummary = { pending:number; approved:number; rejected:number; cancelled:number };

const fmtDate=(v:string)=>new Intl.DateTimeFormat("fi-FI",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(v+"T12:00:00"));
const fmtTime=(v:string|null)=>v?v.slice(0,5):"—";
const n=(v:number)=>Number(v||0).toFixed(2);
function iso(d:Date){ return d.toISOString().slice(0,10); }
function periodFor(anchor:Date){ const y=anchor.getFullYear(), m=anchor.getMonth(), day=anchor.getDate(); const start=day>=21?new Date(y,m,21):new Date(y,m-1,21); const end=new Date(start.getFullYear(),start.getMonth()+1,20); return {start:iso(start),end:iso(end)}; }
function movePeriod(start:string,delta:number){ const d=new Date(start+"T12:00:00"); d.setMonth(d.getMonth()+delta); return periodFor(d); }

export default function EmployeePortalPage(){
  const [profile,setProfile]=useState<Profile|null>(null); const [employee,setEmployee]=useState<Employee|null>(null);
  const [schedule,setSchedule]=useState<Shift[]>([]); const [periodShifts,setPeriodShifts]=useState<Shift[]>([]); const [breakdown,setBreakdown]=useState<TesBreakdown>(emptyTes());
  const [vv,setVv]=useState({earned:0,used:0,balance:0}); const [requestSummary,setRequestSummary]=useState<RequestSummary>({pending:0,approved:0,rejected:0,cancelled:0});
  const [period,setPeriod]=useState(()=>periodFor(new Date())); const [loading,setLoading]=useState(true); const [error,setError]=useState("");

  useEffect(()=>{ void loadIdentity(); },[]);
  useEffect(()=>{ if(employee?.id) void loadPeriod(employee.id,period.start,period.end); },[employee?.id,period.start,period.end]);

  async function loadIdentity(){ setLoading(true); setError(""); try{
    const {data:auth,error:authErr}=await supabase.auth.getUser(); if(authErr) throw authErr; if(!auth.user) throw new Error("Not signed in.");
    const {data:p,error:pErr}=await supabase.from("profiles").select("id,full_name,email,role").eq("id",auth.user.id).single(); if(pErr) throw pErr; setProfile(p as Profile);
    let e:any=null;
    const own=await supabase.from("employees").select("id,name,email,bank_hours,contract_hours").eq("auth_user_id",auth.user.id).maybeSingle();
    if(own.error) throw own.error; e=own.data;
    if(!e && p?.email){ const fallback=await supabase.from("employees").select("id,name,email,bank_hours,contract_hours").eq("email",p.email).maybeSingle(); if(fallback.error) throw fallback.error; e=fallback.data; }
    setEmployee(e as Employee|null); if(!e) return;

    const today=new Date(), from=new Date(today), to=new Date(today); from.setDate(from.getDate()-21); to.setDate(to.getDate()+56);
    const {data:s,error:sErr}=await supabase.from("rota_shifts").select("id,shift_date,shift_slot,start_time,end_time,code,note,restaurant_id").eq("employee_id",e.id).gte("shift_date",iso(from)).lte("shift_date",iso(to)).order("shift_date").order("shift_slot"); if(sErr) throw sErr;
    const ids=[...new Set((s||[]).map((x:any)=>x.restaurant_id).filter(Boolean))]; let map:Record<string,string>={}; if(ids.length){ const rs=await supabase.from("restaurants").select("id,name").in("id",ids); if(!rs.error) map=Object.fromEntries((rs.data||[]).map((r:any)=>[r.id,r.name])); }
    setSchedule((s||[]).map((x:any)=>({...x,restaurant_name:map[x.restaurant_id]||null})));

    const year=new Date().getFullYear(); const ys=`${year}-01-01`, ye=`${year}-12-31`;
    const [yearShifts,adjustments,requests]=await Promise.all([
      supabase.from("rota_shifts").select("shift_date,start_time,end_time,code").eq("employee_id",e.id).gte("shift_date",ys).lte("shift_date",ye),
      supabase.from("vv_adjustments").select("vv_delta").eq("employee_id",e.id).gte("effective_date",ys).lte("effective_date",ye),
      supabase.from("employee_requests").select("status").eq("employee_id",e.id)
    ]);
    if(yearShifts.error) throw yearShifts.error; if(adjustments.error) throw adjustments.error; if(requests.error) throw requests.error;
    let worked=0,used=0; for(const sh of yearShifts.data||[]){ const b=calculateShiftTes(sh as any,[]); worked+=b.worked_hours; used+=b.vv_days; }
    const adj=(adjustments.data||[]).reduce((a:any,x:any)=>a+Number(x.vv_delta||0),0); const earned=vvEarned(worked,200,9); setVv({earned,used,balance:vvBalance(earned,used,adj)});
    const next:RequestSummary={pending:0,approved:0,rejected:0,cancelled:0}; for(const r of requests.data||[]){ const st=(r as any).status as keyof RequestSummary; if(st in next) next[st]++; } setRequestSummary(next);
  }catch(e:any){setError(e?.message||e?.details||JSON.stringify(e));} finally{setLoading(false);} }

  async function loadPeriod(employeeId:string,start:string,end:string){ try{
    const [shifts,special]=await Promise.all([
      supabase.from("rota_shifts").select("id,shift_date,shift_slot,start_time,end_time,code,note,restaurant_id").eq("employee_id",employeeId).gte("shift_date",start).lte("shift_date",end).order("shift_date").order("shift_slot"),
      supabase.from("tes_special_days").select("date,kind,label,premium_start,premium_end").gte("date",start).lte("date",end)
    ]); if(shifts.error) throw shifts.error; if(special.error) throw special.error;
    let total=emptyTes(); for(const sh of shifts.data||[]) total=addTes(total,calculateShiftTes(sh as any,(special.data||[]) as SpecialDay[])); setBreakdown(total); setPeriodShifts((shifts.data||[]) as Shift[]);
  }catch(e:any){ setError(e?.message||String(e)); }
  }

  const upcoming=useMemo(()=>{const t=iso(new Date());return schedule.filter(s=>s.shift_date>=t).slice(0,20)},[schedule]);
  const recent=useMemo(()=>{const t=iso(new Date());return schedule.filter(s=>s.shift_date<t).slice(-8).reverse()},[schedule]);
  if(loading)return <div className="page-card"><p>Loading…</p></div>;

  return <div className="page-stack employee-self-service">
    <div className="page-header"><div><h1>My work</h1><p className="muted">Your own hours and shifts. No salary amounts are shown.</p></div><button className="secondary" onClick={()=>void loadIdentity()}>Refresh</button></div>
    {error&&<div className="error-banner">{error}</div>}
    {!employee&&<div className="info-banner">Your login is not linked to an employee record yet.</div>}

    <section className="page-card"><div className="section-title-row"><div><h2>Hours · payroll period</h2><p className="muted">21st → 20th. Hours only.</p></div><div className="inline-actions"><button className="secondary" onClick={()=>setPeriod(movePeriod(period.start,-1))}>← Previous</button><strong>{period.start} → {period.end}</strong><button className="secondary" onClick={()=>setPeriod(movePeriod(period.start,1))}>Next →</button></div></div>
      <div className="stats-grid">
        <div className="stat-card"><span>Worked</span><strong>{n(breakdown.worked_hours)} h</strong></div><div className="stat-card"><span>Evening</span><strong>{n(breakdown.evening_hours)} h</strong></div><div className="stat-card"><span>Night</span><strong>{n(breakdown.night_hours)} h</strong></div><div className="stat-card"><span>Sunday</span><strong>{n(breakdown.sunday_hours)} h</strong></div><div className="stat-card"><span>Holiday</span><strong>{n(breakdown.holiday_hours)} h</strong></div><div className="stat-card"><span>S</span><strong>{n(breakdown.sick_hours)} h</strong></div><div className="stat-card"><span>VL</span><strong>{n(breakdown.vacation_hours)} h</strong></div><div className="stat-card"><span>VV</span><strong>{n(breakdown.vv_days)}</strong></div><div className="stat-card"><span>Hour bank</span><strong>{n(Number(employee?.bank_hours||0))} h</strong></div>
      </div>
      <p className="muted">{periodShifts.length} shift record(s) in this period.</p>
    </section>

    <div className="stats-grid"><div className="stat-card"><span>Employee</span><strong>{employee?.name||profile?.full_name||profile?.email||"—"}</strong></div><div className="stat-card"><span>VV available</span><strong>{n(vv.balance)}</strong><small>{vv.earned} earned · {n(vv.used)} used</small></div><div className="stat-card"><span>Upcoming shifts</span><strong>{upcoming.length}</strong></div><div className="stat-card"><span>Pending requests</span><strong>{requestSummary.pending}</strong><small>{requestSummary.approved} approved</small></div></div>

    <section className="page-card"><h2>Upcoming shifts</h2>{employee&&upcoming.length===0?<p className="muted">No upcoming shifts found.</p>:null}{upcoming.length>0&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Turn</th><th>Restaurant</th><th>Shift</th><th>Code</th><th>Notes</th></tr></thead><tbody>{upcoming.map(s=><tr key={s.id}><td>{fmtDate(s.shift_date)}</td><td>{s.shift_slot||1}</td><td>{s.restaurant_name||"—"}</td><td><strong>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong></td><td>{s.code?.toUpperCase()||"—"}</td><td>{s.note||""}</td></tr>)}</tbody></table></div>}</section>
    <section className="page-card"><h2>Recent shifts</h2>{recent.length===0?<p className="muted">No recent shifts.</p>:<div className="employee-mini-list">{recent.map(s=><div key={s.id}><strong>{fmtDate(s.shift_date)}</strong><span>{s.restaurant_name||"—"}</span><span>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span></div>)}</div>}</section>
  </div>;
}

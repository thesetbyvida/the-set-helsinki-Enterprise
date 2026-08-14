import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { addTes, calculateShiftTes, emptyTes, type SpecialDay, type TesBreakdown } from "../lib/tes";
import { vvBalance, vvEarned, hoursToNextVv } from "../features/vv/domain";

type Shift = { id:string; shift_date:string; shift_slot?:number|null; start_time:string|null; end_time:string|null; code:string|null; note?:string|null; restaurant_id?:string|null; restaurant_name?:string|null };
type Profile = { id:string; full_name:string|null; email:string|null; role:string|null };
type Employee = { id:string; name:string; email:string|null; bank_hours?:number|null; contract_hours?:number|null };
type RequestSummary = { pending:number; approved:number; rejected:number; cancelled:number };
type OtSummary = { overtime:number; bankDelta:number };

const fmtTime=(v:string|null)=>v?v.slice(0,5):"—";
const n=(v:number)=>Number(v||0).toFixed(2);
function iso(d:Date){ return d.toISOString().slice(0,10); }
function periodFor(anchor:Date){ const y=anchor.getFullYear(),m=anchor.getMonth(),day=anchor.getDate(); const start=day>=21?new Date(y,m,21):new Date(y,m-1,21); const end=new Date(start.getFullYear(),start.getMonth()+1,20); return {start:iso(start),end:iso(end)}; }
function movePeriod(start:string,delta:number){ const d=new Date(start+"T12:00:00"); d.setMonth(d.getMonth()+delta); return periodFor(d); }

export default function EmployeePortalPage(){
  const { language } = useApp();
  const locale=language==="fi"?"fi-FI":language==="es"?"es-ES":"en-GB";
  const words=language==="fi"?{
    title:"Omat työni",subtitle:"Omat tunnit, vuorot ja saldot. Ei palkkasummia.",refresh:"Päivitä",hours:"Tunnit · palkkakausi",period:"21. → 20. · vain tunnit",prev:"← Edellinen",next:"Seuraava →",worked:"Tehdyt",evening:"Ilta",night:"Yö",sunday:"Sunnuntai",holiday:"Pyhä",aatto:"Aatto",sick:"S",vacation:"VL",vv:"VV",overtime:"Ylityö",bank:"Tuntipankki",employee:"Työntekijä",vvAvailable:"VV käytettävissä",nextVv:"Seuraava VV",upcoming:"Tulevat vuorot",pending:"Odottavat pyynnöt",periodDetail:"Palkkakauden vuorot",recent:"Viime vuorot",date:"Päivä",turn:"Vuoro",restaurant:"Ravintola",shift:"Työvuoro",code:"Koodi",shiftHours:"Tunnit",notes:"Huom.",none:"Ei vuoroja.",notLinked:"Kirjautumista ei ole yhdistetty työntekijään.",records:"vuororiviä tällä kaudella",earned:"ansaittu",used:"käytetty",hoursToNext:"h seuraavaan VV:hen"
  }:language==="es"?{
    title:"Mi trabajo",subtitle:"Tus horas, turnos y saldos. Sin importes salariales.",refresh:"Actualizar",hours:"Horas · periodo de nómina",period:"21 → 20 · solo horas",prev:"← Anterior",next:"Siguiente →",worked:"Trabajadas",evening:"Tarde",night:"Noche",sunday:"Domingo",holiday:"Festivo",aatto:"Aatto",sick:"S",vacation:"VL",vv:"VV",overtime:"Extra",bank:"Banco de horas",employee:"Empleado",vvAvailable:"VV disponible",nextVv:"Próximo VV",upcoming:"Próximos turnos",pending:"Solicitudes pendientes",periodDetail:"Turnos del periodo",recent:"Turnos recientes",date:"Fecha",turn:"Turno",restaurant:"Restaurante",shift:"Horario",code:"Código",shiftHours:"Horas",notes:"Notas",none:"No hay turnos.",notLinked:"Tu acceso todavía no está vinculado a un empleado.",records:"registros de turno en este periodo",earned:"ganados",used:"usados",hoursToNext:"h para el próximo VV"
  }:{
    title:"My work",subtitle:"Your own hours, shifts and balances. No salary amounts.",refresh:"Refresh",hours:"Hours · payroll period",period:"21st → 20th · hours only",prev:"← Previous",next:"Next →",worked:"Worked",evening:"Evening",night:"Night",sunday:"Sunday",holiday:"Holiday",aatto:"Aatto",sick:"S",vacation:"VL",vv:"VV",overtime:"Overtime",bank:"Hour bank",employee:"Employee",vvAvailable:"VV available",nextVv:"Next VV",upcoming:"Upcoming shifts",pending:"Pending requests",periodDetail:"Period shifts",recent:"Recent shifts",date:"Date",turn:"Turn",restaurant:"Restaurant",shift:"Shift",code:"Code",shiftHours:"Hours",notes:"Notes",none:"No shifts found.",notLinked:"Your login is not linked to an employee record yet.",records:"shift records in this period",earned:"earned",used:"used",hoursToNext:"h to next VV"
  };
  const fmtDate=(v:string)=>new Intl.DateTimeFormat(locale,{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(v+"T12:00:00"));

  const [profile,setProfile]=useState<Profile|null>(null); const [employee,setEmployee]=useState<Employee|null>(null);
  const [schedule,setSchedule]=useState<Shift[]>([]); const [periodShifts,setPeriodShifts]=useState<Shift[]>([]); const [breakdown,setBreakdown]=useState<TesBreakdown>(emptyTes());
  const [vv,setVv]=useState({earned:0,used:0,balance:0,worked:0}); const [ot,setOt]=useState<OtSummary>({overtime:0,bankDelta:0});
  const [requestSummary,setRequestSummary]=useState<RequestSummary>({pending:0,approved:0,rejected:0,cancelled:0});
  const [period,setPeriod]=useState(()=>periodFor(new Date())); const [loading,setLoading]=useState(true); const [error,setError]=useState("");

  useEffect(()=>{ void loadIdentity(); },[]);
  useEffect(()=>{ if(employee?.id) void loadPeriod(employee.id,period.start,period.end); },[employee?.id,period.start,period.end]);

  async function restaurantMap(ids:string[]){
    if(!ids.length) return {} as Record<string,string>;
    const rpc=await supabase.rpc("rota_restaurant_directory");
    if(!rpc.error) return Object.fromEntries((rpc.data||[]).filter((r:any)=>ids.includes(r.id)).map((r:any)=>[r.id,r.name]));
    return {} as Record<string,string>;
  }

  async function loadIdentity(){ setLoading(true); setError(""); try{
    const {data:auth,error:authErr}=await supabase.auth.getUser(); if(authErr) throw authErr; if(!auth.user) throw new Error("Not signed in.");
    const {data:p,error:pErr}=await supabase.from("profiles").select("id,full_name,email,role").eq("id",auth.user.id).single(); if(pErr) throw pErr; setProfile(p as Profile);
    let e:any=null; const own=await supabase.from("employees").select("id,name,email,bank_hours,contract_hours").eq("auth_user_id",auth.user.id).maybeSingle(); if(own.error) throw own.error; e=own.data;
    if(!e&&p?.email){ const fallback=await supabase.from("employees").select("id,name,email,bank_hours,contract_hours").eq("email",p.email).maybeSingle(); if(fallback.error) throw fallback.error; e=fallback.data; }
    setEmployee(e as Employee|null); if(!e) return;

    const today=new Date(),from=new Date(today),to=new Date(today); from.setDate(from.getDate()-21); to.setDate(to.getDate()+56);
    const {data:s,error:sErr}=await supabase.from("rota_shifts").select("id,shift_date,shift_slot,start_time,end_time,code,note,restaurant_id").eq("employee_id",e.id).gte("shift_date",iso(from)).lte("shift_date",iso(to)).order("shift_date").order("shift_slot"); if(sErr) throw sErr;
    const ids=[...new Set((s||[]).map((x:any)=>x.restaurant_id).filter(Boolean))] as string[]; const map=await restaurantMap(ids); setSchedule((s||[]).map((x:any)=>({...x,restaurant_name:map[x.restaurant_id]||null})));

    const year=new Date().getFullYear(),ys=`${year}-01-01`,ye=`${year}-12-31`;
    const [yearShifts,adjustments,requests]=await Promise.all([
      supabase.from("rota_shifts").select("shift_date,start_time,end_time,code").eq("employee_id",e.id).gte("shift_date",ys).lte("shift_date",ye),
      supabase.from("vv_adjustments").select("vv_delta").eq("employee_id",e.id).gte("effective_date",ys).lte("effective_date",ye),
      supabase.from("employee_requests").select("status").eq("employee_id",e.id)
    ]);
    if(yearShifts.error) throw yearShifts.error; if(adjustments.error) throw adjustments.error; if(requests.error) throw requests.error;
    let worked=0,used=0; for(const sh of yearShifts.data||[]){ const b=calculateShiftTes(sh as any,[]); worked+=b.worked_hours; used+=b.vv_days; }
    const adj=(adjustments.data||[]).reduce((a:any,x:any)=>a+Number(x.vv_delta||0),0); const earned=vvEarned(worked,200,9); setVv({earned,used,balance:vvBalance(earned,used,adj),worked});
    const next:RequestSummary={pending:0,approved:0,rejected:0,cancelled:0}; for(const r of requests.data||[]){ const st=(r as any).status as keyof RequestSummary; if(st in next) next[st]++; } setRequestSummary(next);
  }catch(e:any){setError(e?.message||e?.details||JSON.stringify(e));} finally{setLoading(false);} }

  async function loadPeriod(employeeId:string,start:string,end:string){ try{
    setError("");
    const [shifts,special,ots]=await Promise.all([
      supabase.from("rota_shifts").select("id,shift_date,shift_slot,start_time,end_time,code,note,restaurant_id").eq("employee_id",employeeId).gte("shift_date",start).lte("shift_date",end).order("shift_date").order("shift_slot"),
      supabase.from("tes_special_days").select("date,kind,label,premium_start,premium_end").gte("date",start).lte("date",end),
      supabase.from("overtime_periods").select("overtime_hours,bank_delta").eq("employee_id",employeeId).gte("period_end",start).lte("period_end",end)
    ]); if(shifts.error) throw shifts.error; if(special.error) throw special.error; if(ots.error) throw ots.error;
    let total=emptyTes(); for(const sh of shifts.data||[]) total=addTes(total,calculateShiftTes(sh as any,(special.data||[]) as SpecialDay[])); setBreakdown(total);
    const ids=[...new Set((shifts.data||[]).map((x:any)=>x.restaurant_id).filter(Boolean))] as string[]; const map=await restaurantMap(ids); setPeriodShifts((shifts.data||[]).map((x:any)=>({...x,restaurant_name:map[x.restaurant_id]||null})) as Shift[]);
    setOt((ots.data||[]).reduce((a:any,x:any)=>({overtime:a.overtime+Number(x.overtime_hours||0),bankDelta:a.bankDelta+Number(x.bank_delta||0)}),{overtime:0,bankDelta:0}));
  }catch(e:any){ setError(e?.message||String(e)); }
  }

  const upcoming=useMemo(()=>{const t=iso(new Date());return schedule.filter(s=>s.shift_date>=t).slice(0,20)},[schedule]);
  const recent=useMemo(()=>{const t=iso(new Date());return schedule.filter(s=>s.shift_date<t).slice(-8).reverse()},[schedule]);
  const specialDaysForPeriod=useMemo(()=>[] as SpecialDay[],[period.start,period.end]);
  const shiftHours=(s:Shift)=>calculateShiftTes(s as any,specialDaysForPeriod).base_hours;
  const nextVv=hoursToNextVv(vv.worked,vv.earned,200,9);
  if(loading)return <div className="page-card"><p>Loading…</p></div>;

  return <div className="page-stack employee-self-service">
    <div className="page-header"><div><h1>{words.title}</h1><p className="muted">{words.subtitle}</p></div><button className="secondary" onClick={()=>void loadIdentity()}>{words.refresh}</button></div>
    {error&&<div className="error-banner">{error}</div>}
    {!employee&&<div className="info-banner">{words.notLinked}</div>}

    <section className="page-card"><div className="section-title-row"><div><h2>{words.hours}</h2><p className="muted">{words.period}</p></div><div className="inline-actions"><button className="secondary" onClick={()=>setPeriod(movePeriod(period.start,-1))}>{words.prev}</button><strong>{period.start} → {period.end}</strong><button className="secondary" onClick={()=>setPeriod(movePeriod(period.start,1))}>{words.next}</button></div></div>
      <div className="stats-grid">
        <div className="stat-card"><span>{words.worked}</span><strong>{n(breakdown.worked_hours)} h</strong></div><div className="stat-card"><span>{words.evening}</span><strong>{n(breakdown.evening_hours)} h</strong></div><div className="stat-card"><span>{words.night}</span><strong>{n(breakdown.night_hours)} h</strong></div><div className="stat-card"><span>{words.sunday}</span><strong>{n(breakdown.sunday_hours)} h</strong></div><div className="stat-card"><span>{words.holiday}</span><strong>{n(breakdown.holiday_hours)} h</strong></div><div className="stat-card"><span>{words.aatto}</span><strong>{n(breakdown.eve_hours)} h</strong></div><div className="stat-card"><span>{words.sick}</span><strong>{n(breakdown.sick_hours)} h</strong></div><div className="stat-card"><span>{words.vacation}</span><strong>{n(breakdown.vacation_hours)} h</strong></div><div className="stat-card"><span>{words.vv}</span><strong>{n(breakdown.vv_days)}</strong></div><div className="stat-card"><span>{words.overtime}</span><strong>{n(ot.overtime)} h</strong></div><div className="stat-card"><span>{words.bank}</span><strong>{n(Number(employee?.bank_hours||0))} h</strong><small>{ot.bankDelta>=0?"+":""}{n(ot.bankDelta)} h period Δ</small></div>
      </div><p className="muted">{periodShifts.length} {words.records}.</p>
    </section>

    <div className="stats-grid"><div className="stat-card"><span>{words.employee}</span><strong>{employee?.name||profile?.full_name||profile?.email||"—"}</strong></div><div className="stat-card"><span>{words.vvAvailable}</span><strong>{n(vv.balance)}</strong><small>{vv.earned} {words.earned} · {n(vv.used)} {words.used}</small></div><div className="stat-card"><span>{words.nextVv}</span><strong>{nextVv===null?"MAX":`${n(nextVv)} h`}</strong><small>{nextVv===null?"9 / 9":words.hoursToNext}</small></div><div className="stat-card"><span>{words.pending}</span><strong>{requestSummary.pending}</strong><small>{requestSummary.approved} approved</small></div></div>

    <section className="page-card"><h2>{words.periodDetail}</h2>{periodShifts.length===0?<p className="muted">{words.none}</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>{words.date}</th><th>{words.turn}</th><th>{words.restaurant}</th><th>{words.shift}</th><th>{words.shiftHours}</th><th>{words.code}</th><th>{words.notes}</th></tr></thead><tbody>{periodShifts.map(s=><tr key={s.id}><td>{fmtDate(s.shift_date)}</td><td>{s.shift_slot||1}</td><td>{s.restaurant_name||"—"}</td><td><strong>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong></td><td>{n(shiftHours(s))}</td><td>{s.code?.toUpperCase()||"—"}</td><td>{s.note||""}</td></tr>)}</tbody></table></div>}</section>

    <section className="page-card"><h2>{words.upcoming}</h2>{employee&&upcoming.length===0?<p className="muted">{words.none}</p>:null}{upcoming.length>0&&<div className="table-wrap"><table className="data-table"><thead><tr><th>{words.date}</th><th>{words.turn}</th><th>{words.restaurant}</th><th>{words.shift}</th><th>{words.code}</th><th>{words.notes}</th></tr></thead><tbody>{upcoming.map(s=><tr key={s.id}><td>{fmtDate(s.shift_date)}</td><td>{s.shift_slot||1}</td><td>{s.restaurant_name||"—"}</td><td><strong>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong></td><td>{s.code?.toUpperCase()||"—"}</td><td>{s.note||""}</td></tr>)}</tbody></table></div>}</section>
    <section className="page-card"><h2>{words.recent}</h2>{recent.length===0?<p className="muted">{words.none}</p>:<div className="employee-mini-list">{recent.map(s=><div key={s.id}><strong>{fmtDate(s.shift_date)}</strong><span>{s.restaurant_name||"—"}</span><span>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span></div>)}</div>}</section>
  </div>;
}

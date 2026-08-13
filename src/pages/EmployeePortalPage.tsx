import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Shift = {
  id: string;
  shift_date: string;
  shift_slot?: number | null;
  start_time: string | null;
  end_time: string | null;
  code: string | null;
  note?: string | null;
  restaurant_name?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Employee = {
  id: string;
  name: string;
  email: string | null;
  bank_hours?: number | null;
};

type VVSummary = {
  earned: number;
  used: number;
  balance: number;
};

type RequestSummary = {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
};

const fmtDate = (v: string) => new Intl.DateTimeFormat("fi-FI", {
  weekday: "short", day: "2-digit", month: "2-digit", year: "numeric"
}).format(new Date(v + "T12:00:00"));

const fmtTime = (v: string | null) => v ? v.slice(0,5) : "—";

export default function EmployeePortalPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [vv, setVv] = useState<VVSummary>({ earned: 0, used: 0, balance: 0 });
  const [requestSummary, setRequestSummary] = useState<RequestSummary>({ pending: 0, approved: 0, rejected: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.");

      const { data: authData, error: authErr } = await client.auth.getUser();
      if (authErr) throw authErr;
      const user = authData.user;
      if (!user) throw new Error("Not signed in.");

      const { data: p, error: pErr } = await client
        .from("profiles")
        .select("id,full_name,email,role")
        .eq("id", user.id)
        .single();
      if (pErr) throw pErr;
      setProfile(p);

      let emp: Employee | null = null;
      if (p?.email) {
        const { data: e, error: eErr } = await client
          .from("employees")
          .select("id,name,email,bank_hours")
          .eq("email", p.email)
          .maybeSingle();
        if (eErr) throw eErr;
        emp = e as Employee | null;
        setEmployee(emp);
      }

      if (emp?.id) {
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 14);
        const to = new Date(today);
        to.setDate(to.getDate() + 42);
        const iso = (d: Date) => d.toISOString().slice(0,10);

        const { data: s, error: sErr } = await client
          .from("rota_shifts")
          .select("id,shift_date,shift_slot,start_time,end_time,code,note,restaurant_id")
          .eq("employee_id", emp.id)
          .gte("shift_date", iso(from))
          .lte("shift_date", iso(to))
          .order("shift_date", { ascending: true })
          .order("shift_slot", { ascending: true });
        if (sErr) throw sErr;

        const restIds = [...new Set((s || []).map((x:any)=>x.restaurant_id).filter(Boolean))];
        let restMap: Record<string,string> = {};
        if (restIds.length) {
          const { data: rs } = await client.from("restaurants").select("id,name").in("id", restIds);
          restMap = Object.fromEntries((rs || []).map((r:any)=>[r.id,r.name]));
        }
        setShifts((s || []).map((x:any)=>({ ...x, restaurant_name: restMap[x.restaurant_id] || null })));

        const year = new Date().getFullYear();
        const { data: tx, error: vvErr } = await client
          .from("vv_transactions")
          .select("generated,used,date")
          .eq("employee_id", emp.id)
          .gte("date", `${year}-01-01`)
          .lte("date", `${year}-12-31`);
        if (vvErr) throw vvErr;
        let earned = 0, used = 0;
        for (const t of tx || []) {
          earned += Number((t as any).generated || 0);
          used += Number((t as any).used || 0);
        }
        setVv({ earned, used, balance: earned - used });

        const { data: reqs, error: reqErr } = await client
          .from("employee_requests")
          .select("status")
          .eq("employee_id", emp.id);
        if (reqErr) throw reqErr;
        const next: RequestSummary = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
        for (const r of reqs || []) {
          const status = (r as any).status as keyof RequestSummary;
          if (status in next) next[status] += 1;
        }
        setRequestSummary(next);
      }
    } catch (e:any) {
      setError(e?.message || e?.details || JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return shifts.filter(s => s.shift_date >= today).slice(0, 20);
  }, [shifts]);

  const recent = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return shifts.filter(s => s.shift_date < today).slice(-8).reverse();
  }, [shifts]);

  if (loading) return <div className="page-card"><p>Loading…</p></div>;

  return (
    <div className="page-stack employee-self-service">
      <div className="page-header">
        <div>
          <h1>My work</h1>
          <p className="muted">Your shifts, hour bank, VV balance and request status.</p>
        </div>
        <button className="secondary" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {!employee && (
        <div className="info-banner">
          Your login email is not linked to an employee record yet. Ask an administrator to use the same email in Employees.
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Employee</span>
          <strong>{employee?.name || profile?.full_name || profile?.email || "—"}</strong>
        </div>
        <div className="stat-card">
          <span>Hour bank</span>
          <strong>{Number(employee?.bank_hours || 0).toFixed(2)} h</strong>
        </div>
        <div className="stat-card">
          <span>VV available</span>
          <strong>{vv.balance}</strong>
          <small>{vv.earned} earned · {vv.used} used</small>
        </div>
        <div className="stat-card">
          <span>Upcoming shifts</span>
          <strong>{upcoming.length}</strong>
        </div>
        <div className="stat-card">
          <span>Pending requests</span>
          <strong>{requestSummary.pending}</strong>
          <small>{requestSummary.approved} approved</small>
        </div>
      </div>

      <section className="page-card">
        <div className="section-title-row">
          <div>
            <h2>Upcoming shifts</h2>
            <p className="muted">All scheduled shifts, including split shifts on the same day.</p>
          </div>
        </div>

        {employee && upcoming.length === 0 && <p className="muted">No upcoming shifts found.</p>}

        {upcoming.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Turn</th>
                  <th>Restaurant</th>
                  <th>Shift</th>
                  <th>Code</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(s => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.shift_date)}</td>
                    <td>{s.shift_slot || 1}</td>
                    <td>{s.restaurant_name || "—"}</td>
                    <td><strong>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</strong></td>
                    <td>{s.code?.toUpperCase() || "—"}</td>
                    <td>{s.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="section-title-row">
          <div>
            <h2>Recent shifts</h2>
            <p className="muted">Last scheduled shifts from your rota.</p>
          </div>
        </div>
        {recent.length === 0 ? <p className="muted">No recent shifts.</p> : (
          <div className="employee-mini-list">
            {recent.map(s => (
              <div key={s.id}>
                <strong>{fmtDate(s.shift_date)}</strong>
                <span>{s.restaurant_name || "—"}</span>
                <span>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="page-card">
        <h2>Employee self-service</h2>
        <div className="employee-actions-grid">
          <div className="employee-action-card">
            <h3>My rota</h3>
            <p>See your upcoming work schedule, split shifts and restaurant location.</p>
          </div>
          <div className="employee-action-card">
            <h3>VV</h3>
            <p>{vv.balance} days currently available.</p>
          </div>
          <div className="employee-action-card">
            <h3>Hour bank</h3>
            <p>{Number(employee?.bank_hours || 0).toFixed(2)} hours current balance.</p>
          </div>
          <div className="employee-action-card">
            <h3>Requests</h3>
            <p>{requestSummary.pending} pending · {requestSummary.approved} approved.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

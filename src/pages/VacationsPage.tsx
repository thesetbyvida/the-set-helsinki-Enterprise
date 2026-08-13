import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type RequestRow = {
  id: string;
  employee_id: string;
  request_type: string;
  start_date: string | null;
  end_date: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  employee_name?: string | null;
};

type Employee = {
  id: string;
  name: string;
  email: string | null;
};

function errorText(error: any) {
  return error?.message || error?.details || error?.hint || error?.code || JSON.stringify(error);
}

export default function VacationsPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [type, setType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.");

      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error("Not signed in.");

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("id,email,role")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;

      const admin = ["admin", "super_admin"].includes(profile?.role || "");
      setIsAdmin(admin);

      let emp: Employee | null = null;
      if (profile?.email) {
        const { data: employeeData, error: employeeError } = await client
          .from("employees")
          .select("id,name,email")
          .eq("email", profile.email)
          .maybeSingle();
        if (employeeError) throw employeeError;
        emp = employeeData as Employee | null;
        setEmployee(emp);
      }

      if (admin) {
        const { data: reqs, error: reqError } = await client
          .from("employee_requests")
          .select("id,employee_id,request_type,start_date,end_date,message,status,created_at")
          .order("created_at", { ascending: false });
        if (reqError) throw reqError;

        const employeeIds = [...new Set((reqs || []).map((r:any)=>r.employee_id).filter(Boolean))];
        let names: Record<string,string> = {};
        if (employeeIds.length) {
          const { data: emps } = await client.from("employees").select("id,name").in("id", employeeIds);
          names = Object.fromEntries((emps || []).map((e:any)=>[e.id,e.name]));
        }
        setRequests((reqs || []).map((r:any)=>({ ...r, employee_name: names[r.employee_id] || null })));
      } else if (emp?.id) {
        const { data: reqs, error: reqError } = await client
          .from("employee_requests")
          .select("id,employee_id,request_type,start_date,end_date,message,status,created_at")
          .eq("employee_id", emp.id)
          .order("created_at", { ascending: false });
        if (reqError) throw reqError;
        setRequests((reqs || []).map((r:any)=>({ ...r, employee_name: emp!.name })));
      } else {
        setRequests([]);
      }
    } catch (e:any) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    if (!employee) {
      setError("Your login email is not linked to an employee record.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check environment variables.");
      const { error: insertError } = await client.from("employee_requests").insert({
        employee_id: employee.id,
        request_type: type,
        start_date: startDate,
        end_date: endDate || startDate,
        message: message || null,
        status: "pending",
      });
      if (insertError) throw insertError;
      setStartDate("");
      setEndDate("");
      setMessage("");
      setSuccess("Request sent.");
      await load();
    } catch (e:any) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    setError("");
    setSuccess("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check environment variables.");
      const { error: updateError } = await client
        .from("employee_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw updateError;
      setSuccess(status === "approved" ? "Request approved." : "Request rejected.");
      await load();
    } catch (e:any) {
      setError(errorText(e));
    }
  }

  async function cancelOwn(id: string) {
    setError("");
    setSuccess("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check environment variables.");
      const { error: updateError } = await client
        .from("employee_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw updateError;
      setSuccess("Request cancelled.");
      await load();
    } catch (e:any) {
      setError(errorText(e));
    }
  }

  const pendingCount = useMemo(() => requests.filter(r => r.status === "pending").length, [requests]);

  if (loading) return <div className="page-card"><p>Loading…</p></div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Vacations & requests</h1>
          <p className="muted">
            {isAdmin ? "Review employee requests." : "Request vacation, availability or a shift change."}
          </p>
        </div>
        <button className="secondary" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {!isAdmin && (
        <section className="page-card">
          <h2>New request</h2>
          {!employee && (
            <div className="info-banner">
              Your Supabase login email must match the email in Employees before you can submit requests.
            </div>
          )}
          <form className="request-form-grid" onSubmit={submitRequest}>
            <label>
              Type
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="vacation">Vacation</option>
                <option value="shift_change">Shift change</option>
                <option value="availability">Availability</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Start
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label>
              End
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </label>
            <label className="request-message">
              Message
              <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Optional details" />
            </label>
            <div className="request-form-actions">
              <button className="primary" type="submit" disabled={saving || !employee}>
                {saving ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="page-card">
        <div className="section-title-row">
          <div>
            <h2>{isAdmin ? "Employee requests" : "My requests"}</h2>
            <p className="muted">{pendingCount} pending</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <p className="muted">No requests.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && <th>Employee</th>}
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    {isAdmin && <td><strong>{r.employee_name || "—"}</strong></td>}
                    <td>{r.request_type.replace("_", " ")}</td>
                    <td>{r.start_date || "—"}{r.end_date && r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}</td>
                    <td>{r.message || ""}</td>
                    <td><span className={`status-pill status-${r.status}`}>{r.status}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString("fi-FI")}</td>
                    <td className="request-actions">
                      {isAdmin && r.status === "pending" && (
                        <>
                          <button className="primary small" onClick={() => void setStatus(r.id, "approved")}>Approve</button>
                          <button className="secondary small" onClick={() => void setStatus(r.id, "rejected")}>Reject</button>
                        </>
                      )}
                      {!isAdmin && r.status === "pending" && (
                        <button className="secondary small" onClick={() => void cancelOwn(r.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

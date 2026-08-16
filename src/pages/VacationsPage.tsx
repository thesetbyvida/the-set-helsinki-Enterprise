import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

type RequestRow = {
  id: string;
  employee_id: string;
  request_type: string;
  start_date: string | null;
  end_date: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  message: string | null;
  admin_note: string | null;
  status: RequestStatus;
  created_at: string;
  reviewed_at: string | null;
  employee_name?: string | null;
  restaurant_id: string | null;
  restaurant_name?: string | null;
  applied_to_rota: boolean;
  applied_at: string | null;
};

type Employee = {
  id: string;
  name: string;
  email: string | null;
};

type Restaurant = {
  id: string;
  name: string;
};

function errorText(error: any) {
  return error?.message || error?.details || error?.hint || error?.code || JSON.stringify(error);
}

function requestLabel(value: string) {
  const labels: Record<string,string> = {
    vacation: "Vacation",
    vv: "VV / annual free day",
    shift_change: "Shift change",
    availability: "Availability",
    other: "Other",
  };
  return labels[value] || value.replaceAll("_", " ");
}

export default function VacationsPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string,string>>({});

  const [type, setType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [message, setMessage] = useState("");
  const [restaurantId, setRestaurantId] = useState("");

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

      if (emp?.id) {
        const { data: links, error: linkError } = await client
          .from("employee_restaurants")
          .select("restaurant_id")
          .eq("employee_id", emp.id);
        if (linkError) throw linkError;
        const restaurantIds = (links || []).map((x:any) => x.restaurant_id).filter(Boolean);
        if (restaurantIds.length) {
          const { data: rs, error: restaurantError } = await client
            .from("restaurants")
            .select("id,name")
            .in("id", restaurantIds)
            .order("name");
          if (restaurantError) throw restaurantError;
          const available = (rs || []) as Restaurant[];
          setRestaurants(available);
          setRestaurantId(prev => prev || (available.length === 1 ? available[0].id : ""));
        } else {
          setRestaurants([]);
        }
      } else {
        setRestaurants([]);
      }

      const selectFields = "id,employee_id,restaurant_id,request_type,start_date,end_date,requested_start_time,requested_end_time,message,admin_note,status,created_at,reviewed_at,applied_to_rota,applied_at";

      if (admin) {
        const { data: reqs, error: reqError } = await client
          .from("employee_requests")
          .select(selectFields)
          .order("created_at", { ascending: false });
        if (reqError) throw reqError;

        const employeeIds = [...new Set((reqs || []).map((r:any)=>r.employee_id).filter(Boolean))];
        let names: Record<string,string> = {};
        if (employeeIds.length) {
          const { data: emps } = await client.from("employees").select("id,name").in("id", employeeIds);
          names = Object.fromEntries((emps || []).map((e:any)=>[e.id,e.name]));
        }
        const requestRestaurantIds = [...new Set((reqs || []).map((r:any)=>r.restaurant_id).filter(Boolean))];
        let restaurantNames: Record<string,string> = {};
        if (requestRestaurantIds.length) {
          const { data: rs } = await client.from("restaurants").select("id,name").in("id", requestRestaurantIds);
          restaurantNames = Object.fromEntries((rs || []).map((r:any)=>[r.id,r.name]));
        }
        const rows = (reqs || []).map((r:any)=>({
          ...r,
          employee_name: names[r.employee_id] || null,
          restaurant_name: r.restaurant_id ? restaurantNames[r.restaurant_id] || null : null,
        })) as RequestRow[];
        setRequests(rows);
        setAdminNotes(Object.fromEntries(rows.map(r => [r.id, r.admin_note || ""])));
      } else if (emp?.id) {
        const { data: reqs, error: reqError } = await client
          .from("employee_requests")
          .select(selectFields)
          .eq("employee_id", emp.id)
          .order("created_at", { ascending: false });
        if (reqError) throw reqError;
        const ownNames = Object.fromEntries(restaurants.map(r => [r.id, r.name]));
        const restaurantIds = [...new Set((reqs || []).map((r:any)=>r.restaurant_id).filter(Boolean))];
        let requestNames = ownNames;
        if (restaurantIds.length) {
          const { data: rs } = await client.from("restaurants").select("id,name").in("id", restaurantIds);
          requestNames = { ...requestNames, ...Object.fromEntries((rs || []).map((r:any)=>[r.id,r.name])) };
        }
        setRequests((reqs || []).map((r:any)=>({
          ...r,
          employee_name: emp!.name,
          restaurant_name: r.restaurant_id ? requestNames[r.restaurant_id] || null : null,
        })) as RequestRow[]);
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
    if (!restaurantId) {
      setError("Restaurant is required.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check environment variables.");
      const showTimes = type === "shift_change" || type === "availability";
      const { error: insertError } = await client.from("employee_requests").insert({
        employee_id: employee.id,
        restaurant_id: restaurantId,
        request_type: type,
        start_date: startDate,
        end_date: endDate || startDate,
        requested_start_time: showTimes && startTime ? startTime : null,
        requested_end_time: showTimes && endTime ? endTime : null,
        message: message || null,
        status: "pending",
      });
      if (insertError) throw insertError;
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setMessage("");
      setSuccess("Request sent.");
      await load();
    } catch (e:any) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: "approved" | "rejected", applyToRota = false) {
    setError("");
    setSuccess("");
    try {
      const client = supabase;
      if (!client) throw new Error("Supabase is not configured. Check environment variables.");
      const { error: updateError } = await client.rpc("review_employee_request", {
        p_request_id: id,
        p_status: status,
        p_admin_note: adminNotes[id] || null,
        p_apply_to_rota: applyToRota,
      });
      if (updateError) throw updateError;
      setSuccess(status === "approved"
        ? (applyToRota ? "Request approved and applied to rota." : "Request approved.")
        : "Request rejected.");
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
        .eq("id", id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      setSuccess("Request cancelled.");
      await load();
    } catch (e:any) {
      setError(errorText(e));
    }
  }

  const counts = useMemo(() => ({
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
    cancelled: requests.filter(r => r.status === "cancelled").length,
  }), [requests]);

  const showTimes = type === "shift_change" || type === "availability";

  if (loading) return <div className="page-card"><p>Loading…</p></div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Vacations & requests</h1>
          <p className="muted">
            {isAdmin ? "Review vacation, VV, availability and shift-change requests." : "Request vacation, VV, availability or a shift change."}
          </p>
        </div>
        <button className="secondary" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      {isAdmin && (
        <div className="info-banner">
          Phase 6.4.2: Approve + Rota writes VL/VV only when the full requested date range is safe and never overwrites worked or split shifts.
        </div>
      )}

      <div className="request-kpis">
        <div><span>Pending</span><strong>{counts.pending}</strong></div>
        <div><span>Approved</span><strong>{counts.approved}</strong></div>
        <div><span>Rejected</span><strong>{counts.rejected}</strong></div>
        <div><span>Cancelled</span><strong>{counts.cancelled}</strong></div>
      </div>

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
              Restaurant
              <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)} required>
                <option value="">Select restaurant</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>
              Type
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="vacation">Vacation</option>
                <option value="vv">VV / annual free day</option>
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
            {showTimes && (
              <>
                <label>
                  Requested start time
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </label>
                <label>
                  Requested end time
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </label>
              </>
            )}
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
            <p className="muted">{counts.pending} pending</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <p className="muted">No requests.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table request-table">
              <thead>
                <tr>
                  {isAdmin && <th>Employee</th>}
                  <th>Restaurant</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Requested time</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Rota</th>
                  <th>Admin note</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    {isAdmin && <td><strong>{r.employee_name || "—"}</strong></td>}
                    <td>{r.restaurant_name || "—"}</td>
                    <td>{requestLabel(r.request_type)}</td>
                    <td>{r.start_date || "—"}{r.end_date && r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}</td>
                    <td>{r.requested_start_time ? `${r.requested_start_time.slice(0,5)}${r.requested_end_time ? `–${r.requested_end_time.slice(0,5)}` : ""}` : "—"}</td>
                    <td>{r.message || ""}</td>
                    <td><span className={`status-pill status-${r.status}`}>{r.status}</span></td>
                    <td>{r.applied_to_rota ? <span className="status-pill status-approved">Applied</span> : "—"}</td>
                    <td>
                      {isAdmin && r.status === "pending" ? (
                        <input
                          className="request-admin-note"
                          value={adminNotes[r.id] || ""}
                          onChange={e => setAdminNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Optional note"
                        />
                      ) : (r.admin_note || "—")}
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString("fi-FI")}</td>
                    <td className="request-actions">
                      {isAdmin && r.status === "pending" && (
                        <>
                          <button className="primary small" onClick={() => void setStatus(r.id, "approved")}>Approve</button>
                          {(r.request_type === "vacation" || r.request_type === "vv") && (
                            <button
                              className="primary small"
                              disabled={!r.restaurant_id}
                              title={!r.restaurant_id ? "This older request has no restaurant selected" : "Approve and write VL/VV to the existing rota"}
                              onClick={() => void setStatus(r.id, "approved", true)}
                            >
                              Approve + Rota
                            </button>
                          )}
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

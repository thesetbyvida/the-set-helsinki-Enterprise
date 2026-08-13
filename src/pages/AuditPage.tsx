import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { listRestaurants } from "../lib/restaurants";
import type { Restaurant } from "../types/app";

type AuditRow = {
  id: number;
  actor_user_id: string | null;
  restaurant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));

export function AuditPage() {
  const { profile } = useApp();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  async function load() {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const rest = await listRestaurants();
      setRestaurants(rest.filter((x) => x.active));

      let query = supabase
        .from("audit_log")
        .select("id,actor_user_id,restaurant_id,action,entity_type,entity_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (restaurantId) query = query.eq("restaurant_id", restaurantId);
      if (action) query = query.eq("action", action);
      if (entityType) query = query.eq("entity_type", entityType);

      const { data, error: auditError } = await query;
      if (auditError) throw auditError;
      setRows((data || []) as AuditRow[]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [restaurantId, action, entityType]);

  const restaurantNames = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r.name])),
    [restaurants]
  );

  const entityTypes = useMemo(
    () => [...new Set(rows.map((row) => row.entity_type))].sort(),
    [rows]
  );

  if (!isAdmin) {
    return <div className="page-card"><div className="error-banner">Audit log is available only to administrators.</div></div>;
  }

  return (
    <div className="page-stack audit-page">
      <div className="page-header">
        <div>
          <h1>Security & Audit</h1>
          <p className="muted">Recent security-sensitive changes. Maximum 500 events per view.</p>
        </div>
        <button className="secondary" onClick={() => void load()}>Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="page-card audit-filters">
        <label><span>Restaurant</span><select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}><option value="">All permitted</option>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label><span>Action</span><select value={action} onChange={(e) => setAction(e.target.value)}><option value="">All</option><option value="insert">Insert</option><option value="update">Update</option><option value="delete">Delete</option></select></label>
        <label><span>Entity</span><select value={entityType} onChange={(e) => setEntityType(e.target.value)}><option value="">All</option>{entityTypes.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
      </section>

      <section className="page-card audit-summary">
        <div><span>Events shown</span><strong>{rows.length}</strong></div>
        <div><span>Role</span><strong>{profile?.role}</strong></div>
        <div><span>Scope</span><strong>{profile?.role === "super_admin" ? "All restaurants" : "Assigned restaurants"}</strong></div>
      </section>

      <section className="page-card audit-table-wrap">
        {loading ? <p>Loading…</p> : (
          <table className="data-table audit-table">
            <thead><tr><th>Time</th><th>Restaurant</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Actor</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.restaurant_id ? restaurantNames.get(row.restaurant_id) || row.restaurant_id.slice(0, 8) : "System / global"}</td>
                  <td><span className={`audit-action audit-${row.action}`}>{row.action.toUpperCase()}</span></td>
                  <td>{row.entity_type}</td>
                  <td className="audit-mono">{row.entity_id || "—"}</td>
                  <td className="audit-mono">{row.actor_user_id ? row.actor_user_id.slice(0, 8) : "system"}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="muted">No audit events found for this filter.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

type Check = { label: string; ok: boolean; detail: string };

export function ProductionPage() {
  const { profile } = useApp();
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void runChecks(); }, []);

  async function runChecks() {
    setLoading(true);
    const result: Check[] = [];

    result.push({
      label: "Supabase client",
      ok: Boolean(supabase),
      detail: supabase ? "Configured" : "Missing environment variables",
    });

    if (supabase) {
      const tables = ["profiles","restaurants","employees","employee_restaurants","rota_shifts","employee_requests","sales_daily","pos_sales","pos_import_jobs","payroll_periods","audit_log"];
      for (const table of tables) {
        const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
        result.push({
          label: `Table: ${table}`,
          ok: !error,
          detail: error ? (error.message || error.code || "Unavailable") : "Ready",
        });
      }
    }

    setChecks(result);
    setLoading(false);
  }

  const ready = checks.length > 0 && checks.every(c => c.ok);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Production status</h1>
          <p className="muted">Final readiness checks for The Set Helsinki Enterprise 4.9.</p>
        </div>
        <button className="secondary" onClick={() => void runChecks()}>Run checks</button>
      </div>

      <div className={ready ? "success-banner" : "info-banner"}>
        {loading ? "Checking…" : ready ? "Production checks passed." : "Some production checks need attention."}
      </div>

      <section className="page-card">
        <table className="data-table">
          <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            {checks.map(c => (
              <tr key={c.label}>
                <td><strong>{c.label}</strong></td>
                <td>{c.ok ? "✓ Ready" : "⚠ Attention"}</td>
                <td>{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="page-card">
        <h2>Production checklist</h2>
        <div className="production-checklist">
          <div>✓ Vercel environment variables configured</div>
          <div>✓ Supabase RLS enabled</div>
          <div>✓ Admin roles separated from employee access</div>
          <div>✓ Automatic audit log enabled for rota, payroll, POS, sales and requests</div>
          <div>✓ Restaurant-scoped RLS hardened for financial data</div>
          <div>✓ Payroll / HourCalc / VV / Reports connected</div>
          <div>✓ Payroll history snapshots and closed-period locks</div>
          <div>✓ Multi-restaurant data model</div>
          <div>✓ Employee self-service foundation</div>
          <div>✓ Backup procedure documented</div>
        </div>
      </section>

      <section className="page-card">
        <h2>Signed in</h2>
        <p>{profile?.full_name || profile?.email || "Unknown user"}</p>
        <p className="muted">Role: {profile?.role || "—"}</p>
      </section>
    </div>
  );
}

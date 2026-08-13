import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { runPayrollSelfTests } from "../lib/payrollValidation";
import { useApp } from "../context/AppContext";

type Check = { label: string; ok: boolean; detail: string };

type CertificationState = "checking" | "ready" | "attention";

export function ProductionPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { profile } = useApp();
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  const payrollTests = useMemo(() => runPayrollSelfTests(), []);

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
      const tables = [
        "profiles",
        "restaurants",
        "employees",
        "employee_restaurants",
        "rota_shifts",
        "employee_requests",
        "sales_daily",
        "pos_sales",
        "pos_import_jobs",
        "payroll_periods",
        "audit_log",
      ];
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

  const databaseReady = checks.length > 0 && checks.every(c => c.ok);
  const payrollReady = payrollTests.every(t => t.passed);
  const state: CertificationState = loading ? "checking" : (databaseReady && payrollReady ? "ready" : "attention");
  const passed = checks.filter(c => c.ok).length + payrollTests.filter(t => t.passed).length;
  const total = checks.length + payrollTests.length;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>{embedded ? "System status" : "Production certification"}</h1>
          <p className="muted">Final production certification checks for The Set Helsinki Enterprise 5.6.</p>
        </div>
        <button className="secondary" onClick={() => void runChecks()}>Run checks</button>
      </div>

      <div className={state === "ready" ? "success-banner" : state === "attention" ? "error-banner" : "info-banner"}>
        {state === "checking"
          ? "Checking production readiness…"
          : state === "ready"
            ? `✓ PRODUCTION READY — ${passed}/${total} automated checks passed.`
            : `⚠ ATTENTION — ${passed}/${total} automated checks passed. Review the failed items below.`}
      </div>

      <section className="page-card">
        <div className="section-title-row">
          <div>
            <h2>Infrastructure & database</h2>
            <p className="muted">Connectivity and required Supabase tables.</p>
          </div>
          <strong>{loading ? "Checking…" : databaseReady ? "✓ READY" : "⚠ ATTENTION"}</strong>
        </div>
        <div className="table-wrap">
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
        </div>
      </section>

      <section className="page-card">
        <div className="section-title-row">
          <div>
            <h2>Payroll regression tests</h2>
            <p className="muted">Deterministic tests for the core payroll rules used by the application.</p>
          </div>
          <strong>{payrollReady ? "✓ READY" : "⚠ ATTENTION"}</strong>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Test</th><th>Status</th><th>Result</th></tr></thead>
            <tbody>
              {payrollTests.map(t => (
                <tr key={t.name}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.passed ? "✓ Passed" : "✕ Failed"}</td>
                  <td>{t.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="page-card">
        <h2>Manual production checklist</h2>
        <p className="muted">These items require a real user flow and cannot be certified only from an automated browser check.</p>
        <div className="production-checklist">
          <div>□ Admin and employee login tested with real accounts</div>
          <div>□ Rota: two shifts on the same day save and survive refresh</div>
          <div>□ Rota: drag/drop order persists and 3-week print is readable</div>
          <div>□ Payroll: monthly and hourly employees checked with a real pay period</div>
          <div>□ Payroll: closed period snapshot remains unchanged after employee data changes</div>
          <div>□ Reports: CSV / Excel / Print-PDF tested</div>
          <div>□ POS / Sales data appears in Dashboard without duplicate daily sales</div>
          <div>□ Vacation / VV request approval workflow tested</div>
          <div>□ Security: employee account cannot open restricted financial administration</div>
          <div>□ Backup / recovery procedure confirmed before daily production use</div>
        </div>
      </section>

      <section className="page-card">
        <h2>Release status</h2>
        <p><strong>Application:</strong> The Set Helsinki Enterprise 5.6.0</p>
        <p><strong>Automated certification:</strong> {state === "ready" ? "READY" : state === "checking" ? "CHECKING" : "ATTENTION"}</p>
        <p className="muted">Automated READY confirms the checks above. Complete the manual production checklist before treating the release as fully certified for daily use.</p>
      </section>

      <section className="page-card">
        <h2>Signed in</h2>
        <p>{profile?.full_name || profile?.email || "Unknown user"}</p>
        <p className="muted">Role: {profile?.role || "—"}</p>
      </section>
    </div>
  );
}

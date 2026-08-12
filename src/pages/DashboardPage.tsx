import { useApp } from "../context/AppContext";

export function DashboardPage() {
  const { profile, t } = useApp();

  return (
    <section className="panel">
      <h2>
        {t.welcome}, {profile?.full_name || profile?.email}
      </h2>
      <p>{t.foundation}</p>
      <div className="phase-card">
        <strong>{t.phaseNotice}</strong>
      </div>
    </section>
  );
}

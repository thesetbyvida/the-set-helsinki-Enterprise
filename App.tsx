import { useApp } from "./context/AppContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { UsersPage } from "./pages/UsersPage";
import { RotaPage } from "./pages/RotaPage";

export default function App() {
  const {
    session,
    profile,
    loading,
    error,
    t,
    isSupabaseConfigured,
    reloadProfile,
    logout,
  } = useApp();

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>{t.appName}</h1>
          <div className="alert">{t.missingConfig}</div>
        </div>
      </div>
    );
  }

  if (window.location.pathname.includes("reset-password")) {
    return <ResetPasswordPage />;
  }

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>{t.noProfile}</h2>
          {error && <div className="alert">{error}</div>}
          <code>{session.user.id}</code>
          <button onClick={reloadProfile}>{t.save}</button>
          <button className="secondary" onClick={logout}>
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  if (!profile.is_active) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>{t.noAccess}</h2>
          <button onClick={logout}>{t.logout}</button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {(page) => {
        if (page === "dashboard") return <DashboardPage />;
        if (page === "restaurants") return <RestaurantsPage />;
        if (page === "employees") return <EmployeesPage />;
        if (page === "users") return <UsersPage />;
        if (page === "rota") return <RotaPage />;

        const descriptions: Record<string, string> = {
          payroll: "Phase 7",
          vv: "Phase 8",
          reports: "Phase 12",
          settings: "Phase 13",
        };

        return (
          <PlaceholderPage
            title={t[page] || page}
            description={`${descriptions[page] || "Next phase"} — module prepared for implementation.`}
          />
        );
      }}
    </AppShell>
  );
}

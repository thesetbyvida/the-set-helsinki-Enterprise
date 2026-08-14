import { useApp } from "./context/AppContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SetPasswordPage } from "./pages/SetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { UsersPage } from "./pages/UsersPage";
import { RotaPage } from "./pages/RotaPage";
import { HourCalcPage } from "./pages/HourCalcPage";
import { PayrollPage } from "./pages/PayrollPage";
import { VvPage } from "./pages/VvPage";
import EmployeePortalPage from "./pages/EmployeePortalPage";
import VacationsPage from "./pages/VacationsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { PosPage } from "./pages/PosPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { canOpenPage, defaultPageForRole } from "./lib/access";

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

  if (window.location.pathname.includes("set-password")) {
    return <SetPasswordPage />;
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
        if (!canOpenPage(profile.role, page)) {
          const safePage = defaultPageForRole(profile.role);
          if (safePage === "mywork") return <EmployeePortalPage />;
          return <DashboardPage />;
        }
        if (page === "dashboard") return <DashboardPage />;
        if (page === "restaurants") return <RestaurantsPage />;
        if (page === "employees") return <EmployeesPage />;
        if (page === "users") return <UsersPage />;
        if (page === "rota") return <RotaPage />;
        if (page === "hourcalc") return <HourCalcPage />;
        if (page === "payroll") return <PayrollPage />;
        if (page === "vv") return <VvPage />;
        if (page === "reports") return <ReportsPage />;
        if (page === "pos") return <PosPage />;
        if (page === "audit") return <AuditPage />;
        if (page === "mywork") return <EmployeePortalPage />;
        if (page === "requests") return <VacationsPage />;
        if (page === "settings") return <SettingsPage />;

        const descriptions: Record<string, string> = {
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
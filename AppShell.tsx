import { useState, type ReactNode } from "react";
import { useApp } from "../context/AppContext";
import { LanguageSelector } from "./LanguageSelector";

type PageId =
  | "dashboard"
  | "restaurants"
  | "employees"
  | "users"
  | "rota"
  | "payroll"
  | "vv"
  | "reports"
  | "settings";

interface AppShellProps {
  children: (page: PageId) => ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { profile, logout, t } = useApp();
  const [page, setPage] = useState<PageId>("dashboard");

  const allPages: Array<[PageId, string]> = [
    ["dashboard", t.dashboard],
    ["restaurants", t.restaurants],
    ["employees", t.employees],
    ["users", t.users],
    ["rota", t.rota],
    ["payroll", t.payroll],
    ["vv", t.vv],
    ["reports", t.reports],
    ["settings", t.settings],
  ];

  const visiblePages = allPages.filter(([id]) => {
    if (profile?.role === "employee") return ["dashboard", "rota", "vv"].includes(id);
    if (profile?.role === "manager") return !["users", "settings"].includes(id);
    return true;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>{t.appName}</h1>
          <p>
            {profile?.full_name || profile?.email} / {profile?.role}
          </p>
        </div>
        <div className="topbar-actions">
          <LanguageSelector />
          <button onClick={logout}>{t.logout}</button>
        </div>
      </header>

      <nav className="main-nav">
        {visiblePages.map(([id, label]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="page-container">{children(page)}</main>
    </div>
  );
}

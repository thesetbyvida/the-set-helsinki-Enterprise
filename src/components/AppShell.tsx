import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "../context/AppContext";
import { LanguageSelector } from "./LanguageSelector";
import { canOpenPage, defaultPageForRole, type PageId } from "../lib/access";

interface AppShellProps {
  children: (page: PageId) => ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { profile, logout, t } = useApp();
  const [page, setPage] = useState<PageId>(() => defaultPageForRole(profile?.role));

  useEffect(() => {
    if (!canOpenPage(profile?.role, page)) setPage(defaultPageForRole(profile?.role));
  }, [profile?.role, page]);

  const allPages: Array<[PageId, string]> = [
    ["dashboard", t.dashboard],
    ["restaurants", t.restaurants],
    ["employees", t.employees],
    ["users", t.users],
    ["rota", t.rota],
    ["hourcalc", t.hourCalc || "HourCalc"],
    ["payroll", t.payroll],
    ["vv", t.vv],
    ["reports", t.reports],
    ["pos", t.pos || "POS / Sales"],
    ["audit", "Security / Audit"],
    ["mywork", t.myWork || "My work"],
    ["requests", t.requests || "Requests"],
    ["settings", t.settings],
  ];

  const visiblePages = allPages.filter(([id]) => canOpenPage(profile?.role, id));

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

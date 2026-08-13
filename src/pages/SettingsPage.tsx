import { useState } from "react";
import { ProductionPage } from "./ProductionPage";

type SettingsSection = "overview" | "system";

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("overview");

  if (section === "system") {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h1>Settings</h1>
            <p className="muted">System administration and technical status.</p>
          </div>
          <button className="secondary" onClick={() => setSection("overview")}>← Back to settings</button>
        </div>
        <ProductionPage embedded />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Administration options for The Set Helsinki Enterprise.</p>
        </div>
      </div>
      <section className="page-card">
        <h2>System</h2>
        <p className="muted">Technical checks are kept here so the daily navigation stays focused on restaurant operations.</p>
        <button onClick={() => setSection("system")}>System status</button>
      </section>
    </div>
  );
}

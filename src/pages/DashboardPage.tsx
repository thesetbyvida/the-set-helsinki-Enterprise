import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { listEmployees, listEmployeeRestaurants } from "../lib/employees";
import {
  aggregatePayrollHours,
  calculateOvertimeByEmployee,
  calculatePayrollRow,
  getPayrollSettings,
  listPayrollAdjustments,
  listPayrollShifts,
  listPayrollSpecialDays,
  listRotaPeriodsForRange,
  movePayrollPeriod,
  payrollPeriodForDate,
  type PayrollPeriod,
} from "../lib/payroll";
import { supabase } from "../lib/supabase";
import type { Restaurant } from "../types/app";

type DailySale = {
  id?: string;
  restaurant_id: string;
  sales_date: string;
  net_sales: number;
  gross_sales: number;
  notes?: string | null;
};

type PosSale = {
  restaurant_id: string;
  business_date: string;
  gross_amount: number;
  net_amount: number;
};

type EffectiveDailySale = {
  restaurant_id: string;
  sales_date: string;
  gross_sales: number;
  net_sales: number;
  source: "POS" | "Manual";
};

type RestaurantSummary = {
  restaurant: Restaurant;
  employees: number;
  workedHours: number;
  laborCost: number;
  grossSales: number;
  netSales: number;
  productivity: number;
  laborPercent: number;
  laborPerHour: number;
  salesSource: "POS" | "Manual" | "No sales";
};

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 2 });

function errorText(error: any) {
  return error?.message || error?.details || error?.hint || error?.code || JSON.stringify(error);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fi-FI", { day: "2-digit", month: "2-digit" })
    .format(new Date(`${value}T12:00:00`));
}

function posKey(restaurantId: string, date: string) {
  return `${restaurantId}::${date}`;
}

export function DashboardPage() {
  const { profile, t } = useApp();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [period, setPeriod] = useState<PayrollPeriod>(() => payrollPeriodForDate(new Date(), 21));
  const [summaries, setSummaries] = useState<RestaurantSummary[]>([]);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingSales, setSavingSales] = useState(false);
  const [error, setError] = useState("");
  const [salesDate, setSalesDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salesValue, setSalesValue] = useState("");

  const canManage = profile?.role === "admin" || profile?.role === "super_admin";

  useEffect(() => {
    void load();
  }, [period.start, period.end]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [restaurantRows, employees, employeeRestaurants] = await Promise.all([
        listRestaurants(),
        listEmployees(),
        listEmployeeRestaurants(),
      ]);

      const activeRestaurants = restaurantRows.filter(r => r.active);
      setRestaurants(activeRestaurants);

      const { data: manualSalesRows, error: manualSalesError } = await supabase
        .from("sales_daily")
        .select("id,restaurant_id,sales_date,net_sales,gross_sales,notes")
        .gte("sales_date", period.start)
        .lte("sales_date", period.end)
        .order("sales_date", { ascending: true });
      if (manualSalesError && manualSalesError.code !== "42P01") throw manualSalesError;
      const manualSales = (manualSalesRows || []) as DailySale[];
      setDailySales(manualSales);

      const { data: posRows, error: posError } = await supabase
        .from("pos_sales")
        .select("restaurant_id,business_date,gross_amount,net_amount")
        .gte("business_date", period.start)
        .lte("business_date", period.end)
        .order("business_date", { ascending: true });
      if (posError && posError.code !== "42P01") throw posError;
      const loadedPosSales = (posRows || []) as PosSale[];
      setPosSales(loadedPosSales);

      const posByRestaurant = new Map<string, { gross: number; net: number }>();
      for (const row of loadedPosSales) {
        const current = posByRestaurant.get(row.restaurant_id) || { gross: 0, net: 0 };
        current.gross += Number(row.gross_amount || 0);
        current.net += Number(row.net_amount || 0);
        posByRestaurant.set(row.restaurant_id, current);
      }

      const manualByRestaurant = new Map<string, { gross: number; net: number }>();
      for (const row of manualSales) {
        const current = manualByRestaurant.get(row.restaurant_id) || { gross: 0, net: 0 };
        current.gross += Number(row.gross_sales || 0);
        current.net += Number(row.net_sales || 0);
        manualByRestaurant.set(row.restaurant_id, current);
      }

      const summaryRows: RestaurantSummary[] = [];
      for (const restaurant of activeRestaurants) {
        const assignedIds = new Set(
          employeeRestaurants
            .filter(er => er.restaurant_id === restaurant.id)
            .map(er => er.employee_id)
        );
        const assignedEmployees = employees.filter(e => e.active && assignedIds.has(e.id));

        const [settings, shifts, specialDays, rotaPeriods, adjustments] = await Promise.all([
          getPayrollSettings(restaurant.id),
          listPayrollShifts(restaurant.id, period.start, period.end),
          listPayrollSpecialDays(period.start, period.end),
          listRotaPeriodsForRange(restaurant.id, period.start, period.end),
          listPayrollAdjustments(restaurant.id, period.start, period.end),
        ]);

        const hoursMap = aggregatePayrollHours(shifts, specialDays);
        const overtimeMap = calculateOvertimeByEmployee(
          assignedEmployees,
          shifts,
          rotaPeriods,
          specialDays
        );

        const adjustmentsByEmployee = new Map<string, number>();
        for (const a of adjustments) {
          adjustmentsByEmployee.set(
            a.employee_id,
            (adjustmentsByEmployee.get(a.employee_id) || 0) + Number(a.amount || 0)
          );
        }

        let laborCost = 0;
        let workedHours = 0;
        for (const employee of assignedEmployees) {
          const hours = hoursMap.get(employee.id);
          if (!hours) continue;
          workedHours += hours.worked_hours;
          laborCost += calculatePayrollRow(
            employee,
            hours,
            settings,
            overtimeMap.get(employee.id),
            adjustmentsByEmployee.get(employee.id) || 0
          ).gross_pay;
        }

        const posTotals = posByRestaurant.get(restaurant.id);
        const manualTotals = manualByRestaurant.get(restaurant.id);
        const usePos = Boolean(posTotals && (posTotals.gross > 0 || posTotals.net > 0));
        const grossSales = usePos ? Number(posTotals?.gross || 0) : Number(manualTotals?.gross || 0);
        const netSales = usePos ? Number(posTotals?.net || 0) : Number(manualTotals?.net || 0);
        const salesSource: RestaurantSummary["salesSource"] = usePos
          ? "POS"
          : (manualTotals && (manualTotals.gross > 0 || manualTotals.net > 0) ? "Manual" : "No sales");

        summaryRows.push({
          restaurant,
          employees: assignedEmployees.length,
          workedHours,
          laborCost,
          grossSales,
          netSales,
          productivity: workedHours > 0 ? grossSales / workedHours : 0,
          laborPercent: grossSales > 0 ? (laborCost / grossSales) * 100 : 0,
          laborPerHour: workedHours > 0 ? laborCost / workedHours : 0,
          salesSource,
        });
      }

      setSummaries(summaryRows);

      const { data: requestRows, error: requestsError } = await supabase
        .from("employee_requests")
        .select("id")
        .eq("status", "pending");
      if (!requestsError) setPendingRequests(requestRows?.length || 0);
    } catch (e: any) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveSale() {
    if (selectedRestaurant === "all" || !salesDate) return;
    const value = Number(salesValue.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid sales amount.");
      return;
    }
    setSavingSales(true);
    setError("");
    try {
      const { error: upsertError } = await supabase
        .from("sales_daily")
        .upsert(
          {
            restaurant_id: selectedRestaurant,
            sales_date: salesDate,
            net_sales: value,
            gross_sales: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_id,sales_date" }
        );
      if (upsertError) throw upsertError;
      setSalesValue("");
      await load();
    } catch (e: any) {
      setError(errorText(e));
    } finally {
      setSavingSales(false);
    }
  }

  const visibleSummaries = useMemo(
    () => selectedRestaurant === "all"
      ? summaries
      : summaries.filter(s => s.restaurant.id === selectedRestaurant),
    [summaries, selectedRestaurant]
  );

  const totals = useMemo(() => {
    const data = visibleSummaries.reduce(
      (acc, row) => {
        acc.employees += row.employees;
        acc.workedHours += row.workedHours;
        acc.laborCost += row.laborCost;
        acc.grossSales += row.grossSales;
        acc.netSales += row.netSales;
        return acc;
      },
      { employees: 0, workedHours: 0, laborCost: 0, grossSales: 0, netSales: 0 }
    );
    return {
      ...data,
      productivity: data.workedHours > 0 ? data.grossSales / data.workedHours : 0,
      laborPercent: data.grossSales > 0 ? (data.laborCost / data.grossSales) * 100 : 0,
      laborPerHour: data.workedHours > 0 ? data.laborCost / data.workedHours : 0,
    };
  }, [visibleSummaries]);

  const effectiveDailySales = useMemo<EffectiveDailySale[]>(() => {
    const visibleIds = new Set(visibleSummaries.map(s => s.restaurant.id));
    const posDaily = new Map<string, EffectiveDailySale>();

    for (const row of posSales) {
      if (!visibleIds.has(row.restaurant_id)) continue;
      const key = posKey(row.restaurant_id, row.business_date);
      const current = posDaily.get(key) || {
        restaurant_id: row.restaurant_id,
        sales_date: row.business_date,
        gross_sales: 0,
        net_sales: 0,
        source: "POS" as const,
      };
      current.gross_sales += Number(row.gross_amount || 0);
      current.net_sales += Number(row.net_amount || 0);
      posDaily.set(key, current);
    }

    const out = new Map(posDaily);
    for (const row of dailySales) {
      if (!visibleIds.has(row.restaurant_id)) continue;
      const key = posKey(row.restaurant_id, row.sales_date);
      if (posDaily.has(key)) continue;
      out.set(key, {
        restaurant_id: row.restaurant_id,
        sales_date: row.sales_date,
        gross_sales: Number(row.gross_sales || 0),
        net_sales: Number(row.net_sales || 0),
        source: "Manual",
      });
    }

    return [...out.values()].sort((a, b) => a.sales_date.localeCompare(b.sales_date));
  }, [dailySales, posSales, visibleSummaries]);

  const trend = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of effectiveDailySales) {
      grouped.set(row.sales_date, (grouped.get(row.sales_date) || 0) + row.gross_sales);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, sales]) => ({ date, sales }));
  }, [effectiveDailySales]);

  const maxTrend = Math.max(1, ...trend.map(d => d.sales));

  return (
    <div className="dashboard-pro">
      <div className="dashboard-pro-header">
        <div>
          <h2>{t.welcome}, {profile?.full_name || profile?.email}</h2>
          <p>Dashboard Financial · sales, payroll cost and productivity by restaurant.</p>
        </div>
        <div className="dashboard-pro-controls">
          <label>
            Restaurant
            <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
              <option value="all">All restaurants</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>
            Payroll period
            <input
              type="date"
              value={period.start}
              onChange={e => setPeriod(payrollPeriodForDate(new Date(`${e.target.value}T12:00:00`), 21))}
            />
          </label>
          <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, -1, 21))}>←</button>
          <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, 1, 21))}>→</button>
          <button className="secondary" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>

      <div className="dashboard-period">
        {period.start} → {period.end}
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="dashboard-kpis dashboard-kpis-financial">
        <div className="dashboard-kpi"><span>Gross sales</span><strong>{eur.format(totals.grossSales)}</strong></div>
        <div className="dashboard-kpi"><span>Net sales</span><strong>{eur.format(totals.netSales)}</strong></div>
        <div className="dashboard-kpi"><span>Labor cost</span><strong>{eur.format(totals.laborCost)}</strong></div>
        <div className="dashboard-kpi"><span>Labor %</span><strong>{num.format(totals.laborPercent)} %</strong></div>
        <div className="dashboard-kpi"><span>Worked hours</span><strong>{num.format(totals.workedHours)} h</strong></div>
        <div className="dashboard-kpi"><span>Sales / hour</span><strong>{eur.format(totals.productivity)}</strong></div>
        <div className="dashboard-kpi"><span>Labor / hour</span><strong>{eur.format(totals.laborPerHour)}</strong></div>
        <div className="dashboard-kpi"><span>Employees</span><strong>{totals.employees}</strong></div>
        <div className="dashboard-kpi"><span>Pending requests</span><strong>{pendingRequests}</strong></div>
      </div>

      {loading ? (
        <section className="panel"><p>Loading dashboard…</p></section>
      ) : (
        <>
          <section className="panel dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <h3>Restaurant performance</h3>
                <p>Gross/net sales compared with calculated payroll cost for the selected 21→20 period.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="dashboard-table dashboard-financial-table">
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Employees</th>
                    <th>Worked h</th>
                    <th>Gross sales</th>
                    <th>Net sales</th>
                    <th>Labor cost</th>
                    <th>Labor %</th>
                    <th>Sales / h</th>
                    <th>Labor / h</th>
                    <th>Sales source</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaries.map(row => (
                    <tr key={row.restaurant.id}>
                      <td><strong>{row.restaurant.name}</strong></td>
                      <td>{row.employees}</td>
                      <td>{num.format(row.workedHours)}</td>
                      <td>{eur.format(row.grossSales)}</td>
                      <td>{eur.format(row.netSales)}</td>
                      <td>{eur.format(row.laborCost)}</td>
                      <td>{num.format(row.laborPercent)} %</td>
                      <td>{eur.format(row.productivity)}</td>
                      <td>{eur.format(row.laborPerHour)}</td>
                      <td><span className={`dashboard-source dashboard-source-${row.salesSource.toLowerCase().replace(" ", "-")}`}>{row.salesSource}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="dashboard-two-column">
            <section className="panel dashboard-section">
              <div className="dashboard-section-heading">
                <div>
                  <h3>Sales trend</h3>
                  <p>Last 14 sales days. POS data is used automatically when it exists; manual sales fill missing days.</p>
                </div>
              </div>
              {trend.length === 0 ? (
                <p className="dashboard-empty">No sales entered or imported yet.</p>
              ) : (
                <div className="dashboard-bars">
                  {trend.map(item => (
                    <div className="dashboard-bar-item" key={item.date} title={`${item.date}: ${eur.format(item.sales)}`}>
                      <div className="dashboard-bar-value">{Math.round(item.sales)}</div>
                      <div className="dashboard-bar-track">
                        <div className="dashboard-bar-fill" style={{ height: `${Math.max(4, (item.sales / maxTrend) * 100)}%` }} />
                      </div>
                      <span>{dateLabel(item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel dashboard-section">
              <div className="dashboard-section-heading">
                <div>
                  <h3>Daily sales</h3>
                  <p>Manual fallback. If POS sales exist for the same restaurant/day, POS is used in the dashboard.</p>
                </div>
              </div>

              {canManage ? (
                <div className="dashboard-sales-form">
                  <label>
                    Restaurant
                    <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
                      <option value="all">Select restaurant…</option>
                      {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Date
                    <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} />
                  </label>
                  <label>
                    Sales €
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={salesValue}
                      onChange={e => setSalesValue(e.target.value)}
                    />
                  </label>
                  <button className="primary" disabled={savingSales || selectedRestaurant === "all"} onClick={() => void saveSale()}>
                    {savingSales ? "Saving…" : "Save sales"}
                  </button>
                </div>
              ) : (
                <p className="dashboard-empty">Sales entry is available to admins.</p>
              )}

              <div className="dashboard-sales-list">
                {effectiveDailySales
                  .slice(-8)
                  .reverse()
                  .map(s => (
                    <div key={`${s.restaurant_id}-${s.sales_date}`}>
                      <span>{s.sales_date} · {s.source}</span>
                      <strong>{eur.format(s.gross_sales)}</strong>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

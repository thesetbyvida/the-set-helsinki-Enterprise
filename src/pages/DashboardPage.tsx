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
import type { Employee, Restaurant } from "../types/app";

type DailySale = {
  id?: string;
  restaurant_id: string;
  sales_date: string;
  net_sales: number;
  gross_sales: number;
  notes?: string | null;
};

type RestaurantSummary = {
  restaurant: Restaurant;
  employees: number;
  workedHours: number;
  laborCost: number;
  sales: number;
  productivity: number;
  laborPercent: number;
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

export function DashboardPage() {
  const { profile, t } = useApp();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [period, setPeriod] = useState<PayrollPeriod>(() => payrollPeriodForDate(new Date(), 21));
  const [summaries, setSummaries] = useState<RestaurantSummary[]>([]);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
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

        let sales = 0;
        if (supabase) {
          const { data, error: salesError } = await supabase
            .from("sales_daily")
            .select("gross_sales")
            .eq("restaurant_id", restaurant.id)
            .gte("sales_date", period.start)
            .lte("sales_date", period.end);
          if (salesError && salesError.code !== "42P01") throw salesError;
          sales = (data || []).reduce((sum: number, row: any) => sum + Number(row.gross_sales || 0), 0);
        }

        summaryRows.push({
          restaurant,
          employees: assignedEmployees.length,
          workedHours,
          laborCost,
          sales,
          productivity: workedHours > 0 ? sales / workedHours : 0,
          laborPercent: sales > 0 ? (laborCost / sales) * 100 : 0,
        });
      }

      setSummaries(summaryRows);

      if (supabase) {
        const { data: requestRows, error: requestsError } = await supabase
          .from("employee_requests")
          .select("id", { count: "exact" })
          .eq("status", "pending");
        if (!requestsError) setPendingRequests(requestRows?.length || 0);

        const { data: salesRows, error: salesRowsError } = await supabase
          .from("sales_daily")
          .select("id,restaurant_id,sales_date,net_sales,gross_sales,notes")
          .gte("sales_date", period.start)
          .lte("sales_date", period.end)
          .order("sales_date", { ascending: true });
        if (salesRowsError && salesRowsError.code !== "42P01") throw salesRowsError;
        setDailySales((salesRows || []) as DailySale[]);
      }
    } catch (e: any) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function saveSale() {
    if (!supabase || selectedRestaurant === "all" || !salesDate) return;
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
        acc.sales += row.sales;
        return acc;
      },
      { employees: 0, workedHours: 0, laborCost: 0, sales: 0 }
    );
    return {
      ...data,
      productivity: data.workedHours > 0 ? data.sales / data.workedHours : 0,
      laborPercent: data.sales > 0 ? (data.laborCost / data.sales) * 100 : 0,
    };
  }, [visibleSummaries]);

  const trend = useMemo(() => {
    const ids = new Set(visibleSummaries.map(s => s.restaurant.id));
    const grouped = new Map<string, number>();
    for (const row of dailySales) {
      if (!ids.has(row.restaurant_id)) continue;
      grouped.set(row.sales_date, (grouped.get(row.sales_date) || 0) + Number(row.gross_sales || 0));
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, sales]) => ({ date, sales }));
  }, [dailySales, visibleSummaries]);

  const maxTrend = Math.max(1, ...trend.map(d => d.sales));

  return (
    <div className="dashboard-pro">
      <div className="dashboard-pro-header">
        <div>
          <h2>{t.welcome}, {profile?.full_name || profile?.email}</h2>
          <p>Dashboard PRO · labor cost, hours, sales and productivity.</p>
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
        </div>
      </div>

      <div className="dashboard-period">
        {period.start} → {period.end}
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="dashboard-kpis">
        <div className="dashboard-kpi"><span>Sales</span><strong>{eur.format(totals.sales)}</strong></div>
        <div className="dashboard-kpi"><span>Labor cost</span><strong>{eur.format(totals.laborCost)}</strong></div>
        <div className="dashboard-kpi"><span>Labor %</span><strong>{num.format(totals.laborPercent)} %</strong></div>
        <div className="dashboard-kpi"><span>Worked hours</span><strong>{num.format(totals.workedHours)} h</strong></div>
        <div className="dashboard-kpi"><span>Sales / hour</span><strong>{eur.format(totals.productivity)}</strong></div>
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
                <p>Payroll cost compared with sales for the selected period.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Employees</th>
                    <th>Worked h</th>
                    <th>Sales</th>
                    <th>Labor cost</th>
                    <th>Labor %</th>
                    <th>Sales / h</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaries.map(row => (
                    <tr key={row.restaurant.id}>
                      <td><strong>{row.restaurant.name}</strong></td>
                      <td>{row.employees}</td>
                      <td>{num.format(row.workedHours)}</td>
                      <td>{eur.format(row.sales)}</td>
                      <td>{eur.format(row.laborCost)}</td>
                      <td>{num.format(row.laborPercent)} %</td>
                      <td>{eur.format(row.productivity)}</td>
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
                  <p>Last 14 entered sales days in this payroll period.</p>
                </div>
              </div>
              {trend.length === 0 ? (
                <p className="dashboard-empty">No sales entered yet.</p>
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
                  <p>Enter sales to calculate productivity and labor percentage.</p>
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
                {dailySales
                  .filter(s => selectedRestaurant === "all" || s.restaurant_id === selectedRestaurant)
                  .slice(-8)
                  .reverse()
                  .map(s => (
                    <div key={`${s.restaurant_id}-${s.sales_date}`}>
                      <span>{s.sales_date}</span>
                      <strong>{eur.format(Number(s.gross_sales || 0))}</strong>
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

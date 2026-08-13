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
  listPayrollPeriodRecords,
  listPayrollShifts,
  listPayrollSpecialDays,
  listRotaPeriodsForRange,
  movePayrollPeriod,
  payrollPeriodForDate,
  type PayrollPeriod,
  type PayrollPeriodRecord,
  type PayrollRow,
} from "../lib/payroll";
import { emptyTes } from "../lib/tes";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";

type ReportKind = "payroll" | "hours" | "labor";

type ReportRow = {
  employee: string;
  payBasis: "hourly" | "monthly";
  basePay: number;
  baseHours: number;
  workedHours: number;
  evening: number;
  night: number;
  sunday: number;
  holiday: number;
  premium100: number;
  sick: number;
  vacation: number;
  vv: number;
  overtime: number;
  bankDelta: number;
  bankBalance: number;
  grossPay: number;
};

const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const hours = (n: number) => round2(n).toFixed(2).replace(/\.00$/, "");
const money = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(n || 0));

function errorText(error: any) {
  return error?.message || error?.details || error?.hint || error?.code || JSON.stringify(error);
}

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function csvCell(value: unknown) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function ReportsPage() {
  const { language } = useApp();
  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [period, setPeriod] = useState<PayrollPeriod>(() => payrollPeriodForDate(new Date(), 21));
  const [reportKind, setReportKind] = useState<ReportKind>("payroll");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [periodRecords, setPeriodRecords] = useState<PayrollPeriodRecord[]>([]);
  const [activePeriodRecord, setActivePeriodRecord] = useState<PayrollPeriodRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [r, e, a] = await Promise.all([
          listRestaurants(),
          listEmployees(),
          listEmployeeRestaurants(),
        ]);
        const active = r.filter(x => x.active);
        setRestaurants(active);
        setEmployees(e.filter(x => x.active));
        setAssignments(a);
        if (active.length) setRestaurantId(active[0].id);
      } catch (e: any) {
        setError(errorText(e));
      }
    })();
  }, []);

  const visibleEmployees = useMemo(() => {
    const order = new Map(
      assignments
        .filter(a => a.restaurant_id === restaurantId)
        .map(a => [a.employee_id, a.display_order])
    );
    return employees
      .filter(e => order.has(e.id))
      .sort(
        (a, b) =>
          (order.get(a.id) || 999) - (order.get(b.id) || 999) ||
          a.name.localeCompare(b.name)
      );
  }, [assignments, employees, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    void (async () => {
      try {
        setPeriodRecords(await listPayrollPeriodRecords(restaurantId));
      } catch (e: any) {
        setError(errorText(e));
      }
    })();
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    void loadReport();
  }, [restaurantId, period.start, period.end, visibleEmployees, periodRecords]);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const periodRecord = periodRecords.find(
        r => r.period_start === period.start && r.period_end === period.end
      ) || null;
      setActivePeriodRecord(periodRecord);

      if (periodRecord?.status === "closed" && Array.isArray(periodRecord.rows_snapshot) && periodRecord.rows_snapshot.length) {
        const snapshotRows = periodRecord.rows_snapshot.map((payroll: PayrollRow) => ({
          employee: payroll.employee?.name || "—",
          payBasis: payroll.pay_basis,
          basePay: Number(payroll.base_pay || 0),
          baseHours: Number(payroll.hours?.base_hours || 0),
          workedHours: Number(payroll.hours?.worked_hours || 0),
          evening: Number(payroll.hours?.evening_hours || 0),
          night: Number(payroll.hours?.night_hours || 0),
          sunday: Number(payroll.hours?.sunday_hours || 0),
          holiday: Number(payroll.hours?.holiday_hours || 0),
          premium100: Number(payroll.hours?.premium_100_hours || 0),
          sick: Number(payroll.hours?.sick_hours || 0),
          vacation: Number(payroll.hours?.vacation_hours || 0),
          vv: Number(payroll.hours?.vv_days || 0),
          overtime: Number(payroll.overtime_hours || 0),
          bankDelta: Number(payroll.bank_delta || 0),
          bankBalance: Number(payroll.bank_balance || 0),
          grossPay: Number(payroll.gross_pay || 0),
        }));
        setRows(snapshotRows);
        setLoading(false);
        return;
      }

      const settings = await getPayrollSettings(restaurantId);
      const [shifts, specialDays, rotaPeriods, adjustments] = await Promise.all([
        listPayrollShifts(restaurantId, period.start, period.end),
        listPayrollSpecialDays(period.start, period.end),
        listRotaPeriodsForRange(restaurantId, period.start, period.end),
        listPayrollAdjustments(restaurantId, period.start, period.end),
      ]);

      const byEmployee = aggregatePayrollHours(shifts, specialDays);
      const completedPeriods = rotaPeriods.filter(
        p => p.end_date >= period.start && p.end_date <= period.end
      );
      let overtimeShifts = shifts;
      let overtimeSpecialDays = specialDays;
      if (completedPeriods.length) {
        const overtimeStart = completedPeriods.reduce(
          (m, p) => (p.start_date < m ? p.start_date : m),
          completedPeriods[0].start_date
        );
        const overtimeEnd = completedPeriods.reduce(
          (m, p) => (p.end_date > m ? p.end_date : m),
          completedPeriods[0].end_date
        );
        [overtimeShifts, overtimeSpecialDays] = await Promise.all([
          listPayrollShifts(restaurantId, overtimeStart, overtimeEnd),
          listPayrollSpecialDays(overtimeStart, overtimeEnd),
        ]);
      }
      const overtime = calculateOvertimeByEmployee(
        visibleEmployees,
        overtimeShifts,
        completedPeriods,
        overtimeSpecialDays
      );

      const adjustmentMap = new Map<string, number>();
      for (const adjustment of adjustments) {
        adjustmentMap.set(
          adjustment.employee_id,
          (adjustmentMap.get(adjustment.employee_id) || 0) + Number(adjustment.amount || 0)
        );
      }

      const reportRows = visibleEmployees.map(employee => {
        const breakdown = byEmployee.get(employee.id) || emptyTes();
        const payroll: PayrollRow = calculatePayrollRow(
          employee,
          breakdown,
          settings,
          overtime.get(employee.id),
          adjustmentMap.get(employee.id) || 0
        );

        return {
          employee: employee.name,
          payBasis: payroll.pay_basis,
          basePay: payroll.base_pay,
          baseHours: breakdown.base_hours,
          workedHours: breakdown.worked_hours,
          evening: breakdown.evening_hours,
          night: breakdown.night_hours,
          sunday: breakdown.sunday_hours,
          holiday: breakdown.holiday_hours,
          premium100: breakdown.premium_100_hours,
          sick: breakdown.sick_hours,
          vacation: breakdown.vacation_hours,
          vv: breakdown.vv_days,
          overtime: payroll.overtime_hours,
          bankDelta: payroll.bank_delta,
          bankBalance: payroll.bank_balance,
          grossPay: payroll.gross_pay,
        };
      });

      setRows(reportRows);
    } catch (e: any) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  const restaurantName =
    restaurants.find(r => r.id === restaurantId)?.name || "restaurant";

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          basePay: a.basePay + r.basePay,
          baseHours: a.baseHours + r.baseHours,
          workedHours: a.workedHours + r.workedHours,
          evening: a.evening + r.evening,
          night: a.night + r.night,
          sunday: a.sunday + r.sunday,
          holiday: a.holiday + r.holiday,
          premium100: a.premium100 + r.premium100,
          sick: a.sick + r.sick,
          vacation: a.vacation + r.vacation,
          vv: a.vv + r.vv,
          overtime: a.overtime + r.overtime,
          bankDelta: a.bankDelta + r.bankDelta,
          bankBalance: a.bankBalance + r.bankBalance,
          grossPay: a.grossPay + r.grossPay,
        }),
        {
          basePay: 0,
          baseHours: 0,
          workedHours: 0,
          evening: 0,
          night: 0,
          sunday: 0,
          holiday: 0,
          premium100: 0,
          sick: 0,
          vacation: 0,
          vv: 0,
          overtime: 0,
          bankDelta: 0,
          bankBalance: 0,
          grossPay: 0,
        }
      ),
    [rows]
  );

  function filename(extension: string) {
    const safeRestaurant = restaurantName.replace(/[^a-z0-9-_]+/gi, "-");
    return `${reportKind}-${safeRestaurant}-${period.start}-${period.end}.${extension}`;
  }

  function reportHeaders() {
    if (reportKind === "hours") {
      return [
        "Employee", "Base h", "Worked h", "Evening h", "Night h",
        "Sunday h", "Holiday h", "100% h", "S h", "VL h", "VV",
      ];
    }
    if (reportKind === "labor") {
      return ["Employee", "Pay basis", "Worked h", "Overtime h", "Bank Δ", "Bank balance", "Base payroll", "Gross payroll"];
    }
    return [
      "Employee", "Pay basis", "Base h", "Worked h", "Evening h", "Night h",
      "Sunday h", "Holiday h", "100% h", "S h", "VL h", "VV",
      "Overtime h", "Bank Δ", "Base payroll", "Gross payroll",
    ];
  }

  function reportValues(row: ReportRow) {
    if (reportKind === "hours") {
      return [
        row.employee, hours(row.baseHours), hours(row.workedHours), hours(row.evening),
        hours(row.night), hours(row.sunday), hours(row.holiday), hours(row.premium100),
        hours(row.sick), hours(row.vacation), row.vv,
      ];
    }
    if (reportKind === "labor") {
      return [
        row.employee, row.payBasis === "monthly" ? "Monthly" : "Hourly", hours(row.workedHours), hours(row.overtime),
        hours(row.bankDelta), hours(row.bankBalance), round2(row.basePay), round2(row.grossPay),
      ];
    }
    return [
      row.employee, row.payBasis === "monthly" ? "Monthly" : "Hourly", hours(row.baseHours), hours(row.workedHours), hours(row.evening),
      hours(row.night), hours(row.sunday), hours(row.holiday), hours(row.premium100),
      hours(row.sick), hours(row.vacation), row.vv, hours(row.overtime),
      hours(row.bankDelta), round2(row.basePay), round2(row.grossPay),
    ];
  }

  function exportCsv() {
    const totalValues = reportKind === "hours"
      ? ["Total", hours(totals.baseHours), hours(totals.workedHours), hours(totals.evening), hours(totals.night), hours(totals.sunday), hours(totals.holiday), hours(totals.premium100), hours(totals.sick), hours(totals.vacation), hours(totals.vv)]
      : reportKind === "labor"
        ? ["Total", "—", hours(totals.workedHours), hours(totals.overtime), hours(totals.bankDelta), hours(totals.bankBalance), round2(totals.basePay), round2(totals.grossPay)]
        : ["Total", "—", hours(totals.baseHours), hours(totals.workedHours), hours(totals.evening), hours(totals.night), hours(totals.sunday), hours(totals.holiday), hours(totals.premium100), hours(totals.sick), hours(totals.vacation), hours(totals.vv), hours(totals.overtime), hours(totals.bankDelta), round2(totals.basePay), round2(totals.grossPay)];
    const lines = [
      ["The Set Helsinki Enterprise", restaurantName, `${period.start} → ${period.end}`, activePeriodRecord?.status?.toUpperCase() || "OPEN"].map(csvCell).join(","),
      reportHeaders().map(csvCell).join(","),
      ...rows.map(row => reportValues(row).map(csvCell).join(",")),
      totalValues.map(csvCell).join(","),
    ];
    downloadBlob(
      "\uFEFF" + lines.join("\n"),
      "text/csv;charset=utf-8",
      filename("csv")
    );
  }

  function exportExcel() {
    const headers = reportHeaders();
    const tableRows = rows
      .map(row => `<tr>${reportValues(row).map(v => `<td>${String(v ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const html = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<h2>The Set Helsinki Enterprise</h2>
<p>${restaurantName} · ${period.start} → ${period.end} · ${(activePeriodRecord?.status || "open").toUpperCase()}</p>
<table border="1">
<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
<tbody>${tableRows}</tbody>
<tfoot><tr><th>Total</th><td colspan="${Math.max(1, headers.length - 2)}"></td><th>${reportKind === "hours" ? hours(totals.workedHours) + " h" : money(totals.grossPay, locale)}</th></tr></tfoot>
</table>
</body></html>`;
    downloadBlob(
      "\uFEFF" + html,
      "application/vnd.ms-excel;charset=utf-8",
      filename("xls")
    );
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className="reports-page">
      <div className="reports-header no-print">
        <div>
          <h2>Reports</h2>
          <p>Payroll, accounting hours and labor reports.</p>
        </div>
        <div className="reports-actions">
          <button className="secondary" onClick={exportCsv} disabled={!rows.length}>CSV</button>
          <button className="secondary" onClick={exportExcel} disabled={!rows.length}>Excel</button>
          <button className="primary" onClick={printPdf} disabled={!rows.length}>Print / PDF</button>
        </div>
      </div>

      <section className="panel reports-filters no-print">
        <label>
          Report
          <select value={reportKind} onChange={e => setReportKind(e.target.value as ReportKind)}>
            <option value="payroll">Payroll report</option>
            <option value="hours">Accounting / hours report</option>
            <option value="labor">Labor cost report</option>
          </select>
        </label>

        <label>
          Restaurant
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>

        <label>
          Payroll history
          <select
            value={`${period.start}|${period.end}`}
            onChange={e => {
              const [start, end] = e.target.value.split("|");
              if (start && end) setPeriod({ start, end });
            }}
          >
            <option value={`${period.start}|${period.end}`}>Current: {period.start} → {period.end}</option>
            {periodRecords
              .filter(r => !(r.period_start === period.start && r.period_end === period.end))
              .map(r => (
                <option key={r.id} value={`${r.period_start}|${r.period_end}`}>
                  {r.status === "closed" ? "🔒" : "○"} {r.period_start} → {r.period_end}
                </option>
              ))}
          </select>
        </label>

        <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, -1, 21))}>← Previous</button>
        <div className="reports-period">{period.start} → {period.end}</div>
        <button className="secondary" onClick={() => setPeriod(movePayrollPeriod(period, 1, 21))}>Next →</button>
      </section>

      {error && <div className="alert no-print">{error}</div>}

      <section className="panel report-paper">
        <div className="report-print-header">
          <div>
            <h1>The Set Helsinki Enterprise</h1>
            <h2>{reportKind === "payroll" ? "Payroll Report" : reportKind === "hours" ? "Accounting Hours Report" : "Labor Cost Report"}</h2>
          </div>
          <div>
            <strong>{restaurantName}</strong>
            <span>{period.start} → {period.end}</span>
            <span className={`report-status ${activePeriodRecord?.status === "closed" ? "closed" : "open"}`}>
              {activePeriodRecord?.status === "closed" ? "CLOSED · historical snapshot" : "OPEN · live calculation"}
            </span>
          </div>
        </div>

        {loading ? (
          <p>Loading report…</p>
        ) : (
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  {reportHeaders().map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.employee}>
                    {reportValues(row).map((value, index) => (
                      <td key={index} className={index === 0 ? "report-name" : ""}>
                        {reportKind !== "hours" && index === reportValues(row).length - 1
                          ? money(Number(value), locale)
                          : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  {reportKind === "hours" && <>
                    <th>{hours(totals.baseHours)}</th>
                    <th>{hours(totals.workedHours)}</th>
                    <th>{hours(totals.evening)}</th>
                    <th>{hours(totals.night)}</th>
                    <th>{hours(totals.sunday)}</th>
                    <th>{hours(totals.holiday)}</th>
                    <th>{hours(totals.premium100)}</th>
                    <th>{hours(totals.sick)}</th>
                    <th>{hours(totals.vacation)}</th>
                    <th>{hours(totals.vv)}</th>
                  </>}
                  {reportKind === "labor" && <>
                    <th>—</th>
                    <th>{hours(totals.workedHours)}</th>
                    <th>{hours(totals.overtime)}</th>
                    <th>{hours(totals.bankDelta)}</th>
                    <th>{hours(totals.bankBalance)}</th>
                    <th>{money(totals.basePay, locale)}</th>
                    <th>{money(totals.grossPay, locale)}</th>
                  </>}
                  {reportKind === "payroll" && <>
                    <th>—</th>
                    <th>{hours(totals.baseHours)}</th>
                    <th>{hours(totals.workedHours)}</th>
                    <th>{hours(totals.evening)}</th>
                    <th>{hours(totals.night)}</th>
                    <th>{hours(totals.sunday)}</th>
                    <th>{hours(totals.holiday)}</th>
                    <th>{hours(totals.premium100)}</th>
                    <th>{hours(totals.sick)}</th>
                    <th>{hours(totals.vacation)}</th>
                    <th>{hours(totals.vv)}</th>
                    <th>{hours(totals.overtime)}</th>
                    <th>{hours(totals.bankDelta)}</th>
                    <th>{money(totals.basePay, locale)}</th>
                    <th>{money(totals.grossPay, locale)}</th>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <p className="reports-note no-print">
        “Print / PDF” opens the browser print dialog. Choose “Save as PDF” to create a PDF.
        Excel export uses an Excel-compatible .xls file and does not require an extra JavaScript library.
        Closed payroll periods are exported from the stored historical snapshot; open periods are calculated from current rota data.
      </p>
    </div>
  );
}

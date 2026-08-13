import type { PayrollRow, PayrollSettings } from "./payroll";
import { calculatePayrollRow, defaultPayrollSettings } from "./payroll";
import { calculateShiftTes, emptyTes, type TesBreakdown } from "./tes";
import type { Employee, RotaShift } from "../types/app";

export type ValidationSeverity = "error" | "warning";

export interface PayrollValidationIssue {
  severity: ValidationSeverity;
  employeeId?: string;
  employeeName?: string;
  code: string;
  message: string;
}

export interface PayrollSelfTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const close = (actual: number, expected: number, tolerance = 0.02) =>
  Math.abs(Number(actual) - Number(expected)) <= tolerance;

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "test-employee",
  employee_number: null,
  name: "Test Employee",
  email: null,
  phone: null,
  address: null,
  birth_date: null,
  job_title: null,
  contract_type: "112.5h",
  contract_hours: 112.5,
  hourly_rate: 20,
  monthly_salary: 0,
  bank_hours: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const shift = (overrides: Partial<RotaShift>): RotaShift => ({
  id: "test-shift",
  period_id: "test-period",
  restaurant_id: "test-restaurant",
  employee_id: "test-employee",
  shift_date: "2026-08-14",
  shift_slot: 1,
  start_time: null,
  end_time: null,
  code: "",
  note: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

function test(name: string, condition: boolean, detail: string): PayrollSelfTestResult {
  return { name, passed: condition, detail };
}

/**
 * Deterministic regression checks for The Set Helsinki payroll rules.
 * These do not call Supabase and can run safely in the browser.
 */
export function runPayrollSelfTests(): PayrollSelfTestResult[] {
  const results: PayrollSelfTestResult[] = [];

  const normal = calculateShiftTes(shift({ start_time: "17:00", end_time: "23:00" }));
  results.push(test(
    "Evening split 18:00–24:00",
    close(normal.worked_hours, 6) && close(normal.evening_hours, 5) && close(normal.night_hours, 0),
    `17:00–23:00 => worked ${normal.worked_hours} h, evening ${normal.evening_hours} h, night ${normal.night_hours} h`,
  ));

  const overnight = calculateShiftTes(shift({ start_time: "22:00", end_time: "03:30" }));
  results.push(test(
    "Night split across midnight",
    close(overnight.worked_hours, 5.5) && close(overnight.evening_hours, 2) && close(overnight.night_hours, 3.5),
    `22:00–03:30 => worked ${overnight.worked_hours} h, evening ${overnight.evening_hours} h, night ${overnight.night_hours} h`,
  ));

  // 2026-08-15 is Saturday; after midnight is Sunday.
  const satSun = calculateShiftTes(shift({ shift_date: "2026-08-15", start_time: "22:00", end_time: "03:00" }));
  results.push(test(
    "Saturday → Sunday premium",
    close(satSun.worked_hours, 5) && close(satSun.sunday_hours, 3) && close(satSun.premium_100_hours, 3),
    `Sat 22:00–Sun 03:00 => Sunday premium ${satSun.premium_100_hours} h`,
  ));

  // The Set house rule retained from the rota specification: an overnight shift
  // that starts on Sunday keeps Sunday premium through the end of that shift.
  const sunMon = calculateShiftTes(shift({ shift_date: "2026-08-16", start_time: "20:00", end_time: "01:00" }));
  results.push(test(
    "Sunday → Monday house rule",
    close(sunMon.worked_hours, 5) && close(sunMon.sunday_hours, 5) && close(sunMon.premium_100_hours, 5),
    `Sun 20:00–Mon 01:00 => Sunday premium ${sunMon.premium_100_hours} h`,
  ));

  const sick = calculateShiftTes(shift({ code: "s" }));
  const vacation = calculateShiftTes(shift({ code: "vl" }));
  const vv = calculateShiftTes(shift({ code: "vv" }));
  results.push(test("S code", close(sick.base_hours, 7.5) && close(sick.sick_hours, 7.5), `S => ${sick.base_hours} paid h`));
  results.push(test("VL code", close(vacation.base_hours, 7.5) && close(vacation.vacation_hours, 7.5), `VL => ${vacation.base_hours} paid h`));
  results.push(test("VV code", close(vv.base_hours, 0) && vv.vv_days === 1, `VV => ${vv.vv_days} day, ${vv.base_hours} paid h`));

  const settings = defaultPayrollSettings("test-restaurant");
  const monthly = calculatePayrollRow(
    employee({ contract_type: "monthly", monthly_salary: 3180, hourly_rate: 99 }),
    emptyTes(),
    settings,
  );
  results.push(test(
    "Monthly salary basis",
    close(monthly.base_pay, 3180) && close(monthly.reference_hourly_rate, 20),
    `€3180 monthly => base €${monthly.base_pay}, reference €${monthly.reference_hourly_rate}/h`,
  ));

  const eightHours: TesBreakdown = { ...emptyTes(), base_hours: 8, worked_hours: 8 };
  const hourly = calculatePayrollRow(employee({ contract_type: "0h", hourly_rate: 25.16 }), eightHours, settings);
  results.push(test(
    "Hourly base pay",
    close(hourly.base_pay, 201.28),
    `8 h × €25.16 => €${hourly.base_pay}`,
  ));

  return results;
}

export function validatePayrollConfiguration(
  rows: PayrollRow[],
  settings: PayrollSettings,
): PayrollValidationIssue[] {
  const issues: PayrollValidationIssue[] = [];

  if (Number(settings.evening_eur_per_hour || 0) <= 0) {
    issues.push({ severity: "error", code: "EVENING_RATE", message: "Evening supplement rate is missing or zero." });
  }
  if (Number(settings.night_eur_per_hour || 0) <= 0) {
    issues.push({ severity: "error", code: "NIGHT_RATE", message: "Night supplement rate is missing or zero." });
  }

  for (const row of rows) {
    const base = { employeeId: row.employee.id, employeeName: row.employee.name };
    if (row.pay_basis === "monthly" && Number(row.monthly_salary || 0) <= 0) {
      issues.push({ ...base, severity: "error", code: "MONTHLY_SALARY", message: `${row.employee.name}: monthly employee has no monthly salary.` });
    }
    if (row.pay_basis === "hourly" && Number(row.reference_hourly_rate || 0) <= 0) {
      issues.push({ ...base, severity: "error", code: "HOURLY_RATE", message: `${row.employee.name}: hourly employee has no hourly rate.` });
    }
    if (row.employee.contract_type !== "0h" && Number(row.employee.contract_hours || 0) <= 0) {
      issues.push({ ...base, severity: "warning", code: "CONTRACT_HOURS", message: `${row.employee.name}: contract hours are zero or missing.` });
    }
    if (row.pay_basis === "monthly" && Number(row.employee.hourly_rate || 0) > 0) {
      issues.push({ ...base, severity: "warning", code: "STALE_HOURLY_RATE", message: `${row.employee.name}: an hourly rate is also stored, but monthly salary is used as the payroll basis.` });
    }
    if (!Number.isFinite(row.gross_pay) || row.gross_pay < 0) {
      issues.push({ ...base, severity: "error", code: "GROSS_PAY", message: `${row.employee.name}: gross payroll result is invalid.` });
    }
  }

  return issues;
}

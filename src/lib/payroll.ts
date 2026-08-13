import { supabase } from "./supabase";
import { addDays, isoDate, parseIsoDate } from "./rota";
import { addTes, calculateShiftTes, emptyTes, type SpecialDay, type TesBreakdown } from "./tes";
import type { Employee, RotaShift } from "../types/app";

export interface PayrollSettings {
  restaurant_id: string;
  period_start_day: number;
  evening_eur_per_hour: number;
  night_eur_per_hour: number;
  eve_eur_per_hour: number;
  overtime_eur_per_hour: number;
  updated_at?: string;
}

export interface PayrollPeriod { start: string; end: string; }
export interface RotaPeriodLite { id: string; start_date: string; end_date: string; }
export interface PayrollAdjustment {
  id: string; employee_id: string; restaurant_id: string; payroll_date: string;
  amount: number; label: string; note: string; created_by: string | null; created_at: string;
}
export interface OvertimeSummary { contract_hours: number; worked_hours: number; overtime_hours: number; bank_delta: number; }

export interface PayrollRow {
  employee: Employee;
  hours: TesBreakdown;
  contract_hours: number;
  overtime_hours: number;
  bank_delta: number;
  bank_balance: number;
  pay_basis: "hourly" | "monthly";
  reference_hourly_rate: number;
  monthly_salary: number;
  base_pay: number;
  evening_pay: number;
  night_pay: number;
  premium_100_pay: number;
  eve_pay: number;
  overtime_pay: number;
  adjustments_pay: number;
  gross_pay: number;
}

export const defaultPayrollSettings = (restaurantId: string): PayrollSettings => ({
  restaurant_id: restaurantId, period_start_day: 21,
  evening_eur_per_hour: 0, night_eur_per_hour: 0, eve_eur_per_hour: 0, overtime_eur_per_hour: 0,
});

export async function getPayrollSettings(restaurantId: string): Promise<PayrollSettings> {
  if (!supabase) return defaultPayrollSettings(restaurantId);
  const { data, error } = await supabase.from("payroll_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  if (error) throw error;
  return data ? { ...defaultPayrollSettings(restaurantId), ...(data as Partial<PayrollSettings>) } : defaultPayrollSettings(restaurantId);
}

export async function savePayrollSettings(settings: PayrollSettings): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("payroll_settings").upsert({ ...settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function payrollPeriodForDate(date: Date, startDay = 21): PayrollPeriod {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const start = d.getDate() >= startDay ? new Date(d.getFullYear(), d.getMonth(), startDay, 12) : new Date(d.getFullYear(), d.getMonth() - 1, startDay, 12);
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, startDay, 12);
  return { start: isoDate(start), end: isoDate(addDays(nextStart, -1)) };
}

export function movePayrollPeriod(period: PayrollPeriod, months: number, startDay = 21): PayrollPeriod {
  const current = parseIsoDate(period.start);
  return payrollPeriodForDate(new Date(current.getFullYear(), current.getMonth() + months, startDay, 12), startDay);
}

export async function listPayrollShifts(restaurantId: string, start: string, end: string): Promise<RotaShift[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("rota_shifts").select("*").eq("restaurant_id", restaurantId).gte("shift_date", start).lte("shift_date", end).order("shift_date");
  if (error) throw error;
  return (data || []) as RotaShift[];
}

export async function listPayrollSpecialDays(start: string, end: string): Promise<SpecialDay[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tes_special_days").select("date,kind,label,premium_start,premium_end").gte("date", start).lte("date", end).order("date");
  if (error) throw error;
  return (data || []) as SpecialDay[];
}

export async function listRotaPeriodsForRange(restaurantId: string, start: string, end: string): Promise<RotaPeriodLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("rota_periods").select("id,start_date,end_date").eq("restaurant_id", restaurantId).lte("start_date", end).gte("end_date", start).order("start_date");
  if (error) throw error;
  return (data || []) as RotaPeriodLite[];
}

export async function listPayrollAdjustments(restaurantId: string, start: string, end: string): Promise<PayrollAdjustment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("payroll_adjustments").select("*").eq("restaurant_id", restaurantId).gte("payroll_date", start).lte("payroll_date", end).order("payroll_date");
  if (error) throw error;
  return (data || []) as PayrollAdjustment[];
}

export function aggregatePayrollHours(shifts: RotaShift[], specialDays: SpecialDay[]): Map<string, TesBreakdown> {
  const out = new Map<string, TesBreakdown>();
  for (const shift of shifts) {
    const current = out.get(shift.employee_id) || emptyTes();
    out.set(shift.employee_id, addTes(current, calculateShiftTes(shift, specialDays)));
  }
  return out;
}

export function calculateOvertimeByEmployee(
  employees: Employee[], shifts: RotaShift[], periods: RotaPeriodLite[], specialDays: SpecialDay[]
): Map<string, OvertimeSummary> {
  const out = new Map<string, OvertimeSummary>();
  const periodMap = new Map(periods.map(p => [p.id, p]));
  const grouped = new Map<string, Map<string, number>>();
  for (const shift of shifts) {
    if (!periodMap.has(shift.period_id)) continue;
    const worked = calculateShiftTes(shift, specialDays).worked_hours;
    const byPeriod = grouped.get(shift.employee_id) || new Map<string, number>();
    byPeriod.set(shift.period_id, (byPeriod.get(shift.period_id) || 0) + worked);
    grouped.set(shift.employee_id, byPeriod);
  }
  for (const employee of employees) {
    let contract = 0, worked = 0, overtime = 0, bank = 0;
    const threshold = employee.contract_type === "0h" ? null : Number(employee.contract_hours || 112.5);
    const byPeriod = grouped.get(employee.id) || new Map<string, number>();
    for (const period of periods) {
      const wh = byPeriod.get(period.id) || 0;
      worked += wh;
      if (threshold !== null) {
        contract += threshold;
        overtime += Math.max(0, wh - threshold);
        bank += wh - threshold;
      }
    }
    out.set(employee.id, {
      contract_hours: round2(contract), worked_hours: round2(worked),
      overtime_hours: round2(overtime), bank_delta: round2(bank),
    });
  }
  return out;
}

const money2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePayrollRow(
  employee: Employee, hours: TesBreakdown, settings: PayrollSettings,
  overtime: OvertimeSummary = { contract_hours: 0, worked_hours: 0, overtime_hours: 0, bank_delta: 0 },
  adjustmentsPay = 0
): PayrollRow {
  const hourlyRate = Number(employee.hourly_rate || 0);
  const monthlySalary = Number(employee.monthly_salary || 0);
  const isMonthly = employee.contract_type === "monthly" || monthlySalary > 0;

  // Monthly employees receive the configured fixed monthly salary for a full payroll period.
  // For percentage-based supplements (Sunday/holiday 100%), prefer an explicitly configured
  // hourly rate. If none is stored, derive a reference rate from the employee's contracted
  // 3-week hours (e.g. 112.5 h / 3 weeks -> 162.5 h/month).
  const contractHours3w = Number(employee.contract_hours || 0);
  const monthlyEquivalentHours = contractHours3w > 0 ? contractHours3w * 52 / 36 : 0;
  const referenceHourlyRate = hourlyRate > 0
    ? hourlyRate
    : (isMonthly && monthlySalary > 0 && monthlyEquivalentHours > 0
      ? monthlySalary / monthlyEquivalentHours
      : 0);

  const basePay = isMonthly ? monthlySalary : hours.base_hours * hourlyRate;
  const eveningPay = hours.evening_hours * Number(settings.evening_eur_per_hour || 0);
  const nightPay = hours.night_hours * Number(settings.night_eur_per_hour || 0);
  const premium100Pay = hours.premium_100_hours * referenceHourlyRate;
  const evePay = hours.eve_hours * Number(settings.eve_eur_per_hour || 0);
  // Base pay already contains every worked hour. This is only an EXTRA overtime supplement.
  const overtimePay = overtime.overtime_hours * Number(settings.overtime_eur_per_hour || 0);
  const gross = basePay + eveningPay + nightPay + premium100Pay + evePay + overtimePay + adjustmentsPay;
  return {
    employee, hours,
    contract_hours: overtime.contract_hours,
    overtime_hours: overtime.overtime_hours,
    bank_delta: overtime.bank_delta,
    bank_balance: round2(Number(employee.bank_hours || 0) + overtime.bank_delta),
    pay_basis: isMonthly ? "monthly" : "hourly",
    reference_hourly_rate: money2(referenceHourlyRate),
    monthly_salary: money2(monthlySalary),
    base_pay: money2(basePay), evening_pay: money2(eveningPay), night_pay: money2(nightPay),
    premium_100_pay: money2(premium100Pay), eve_pay: money2(evePay), overtime_pay: money2(overtimePay),
    adjustments_pay: money2(adjustmentsPay), gross_pay: money2(gross),
  };
}

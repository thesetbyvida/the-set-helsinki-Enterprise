import { supabase } from "./supabase";
import { addDays, isoDate, parseIsoDate } from "./rota";
import { addTes, calculateShiftTes, emptyTes, type SpecialDay, type TesBreakdown } from "./tes";
import type { Employee, RotaShift } from "../types/app";

export interface PayrollSettings {
  restaurant_id: string;
  period_start_day: number;
  evening_eur_per_hour: number;
  night_eur_per_hour: number;
  // Kept for DB backwards compatibility. Phase 4.4 calculates aatto from TES percentages.
  eve_eur_per_hour: number;
  // Kept for DB backwards compatibility. Phase 4.4 calculates overtime as 50%/100% of base hourly rate.
  overtime_eur_per_hour: number;
  updated_at?: string;
}

export interface PayrollPeriod { start: string; end: string; }
export interface RotaPeriodLite { id: string; start_date: string; end_date: string; }
export interface PayrollAdjustment {
  id: string; employee_id: string; restaurant_id: string; payroll_date: string;
  amount: number; label: string; note: string; created_by: string | null; created_at: string;
}
export interface OvertimeSummary {
  contract_hours: number;
  worked_hours: number;
  additional_work_hours: number;
  overtime_50_hours: number;
  overtime_100_hours: number;
  overtime_hours: number;
  bank_delta: number;
}

export interface PayrollRow {
  employee: Employee;
  hours: TesBreakdown;
  contract_hours: number;
  additional_work_hours: number;
  overtime_50_hours: number;
  overtime_100_hours: number;
  overtime_hours: number;
  bank_delta: number;
  bank_balance: number;
  pay_basis: "hourly" | "monthly";
  reference_hourly_rate: number;
  monthly_salary: number;
  base_pay: number;
  extra_work_base_pay: number;
  evening_pay: number;
  night_pay: number;
  premium_100_base_pay: number;
  premium_100_supplement_pay: number;
  premium_100_pay: number;
  eve_pay: number;
  overtime_pay: number;
  adjustments_pay: number;
  gross_pay: number;
}

export const defaultPayrollSettings = (restaurantId: string): PayrollSettings => ({
  restaurant_id: restaurantId,
  period_start_day: 21,
  // Current MaRa/PAM employee TES rates effective in 2026. Still editable per restaurant.
  evening_eur_per_hour: 1.40,
  night_eur_per_hour: 2.37,
  eve_eur_per_hour: 0,
  overtime_eur_per_hour: 0,
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

/**
 * MaRa/PAM 3-week work-time model used in Phase 4.4:
 * - regular maximum: 112.5 h / 3 weeks
 * - additional work: above the employee's agreed hours up to 120 h
 * - overtime: above 120 h; first 18 h +50%, following hours +100%
 *
 * Bank delta remains measured against the employee's agreed contract hours.
 */
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
    let contract = 0;
    let worked = 0;
    let additional = 0;
    let overtime50 = 0;
    let overtime100 = 0;
    let bank = 0;
    const contractHours = employee.contract_type === "0h" ? 0 : Number(employee.contract_hours || 112.5);
    const byPeriod = grouped.get(employee.id) || new Map<string, number>();

    for (const period of periods) {
      const wh = byPeriod.get(period.id) || 0;
      worked += wh;
      contract += contractHours;
      bank += wh - contractHours;

      const additionalStart = Math.min(Math.max(contractHours, 0), 120);
      additional += Math.max(0, Math.min(wh, 120) - additionalStart);

      const ot = Math.max(0, wh - 120);
      overtime50 += Math.min(18, ot);
      overtime100 += Math.max(0, ot - 18);
    }

    out.set(employee.id, {
      contract_hours: round2(contract),
      worked_hours: round2(worked),
      additional_work_hours: round2(additional),
      overtime_50_hours: round2(overtime50),
      overtime_100_hours: round2(overtime100),
      overtime_hours: round2(overtime50 + overtime100),
      bank_delta: round2(bank),
    });
  }
  return out;
}

const money2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePayrollRow(
  employee: Employee, hours: TesBreakdown, settings: PayrollSettings,
  overtime: OvertimeSummary = {
    contract_hours: 0,
    worked_hours: 0,
    additional_work_hours: 0,
    overtime_50_hours: 0,
    overtime_100_hours: 0,
    overtime_hours: 0,
    bank_delta: 0,
  },
  adjustmentsPay = 0
): PayrollRow {
  const hourlyRate = Number(employee.hourly_rate || 0);
  const monthlySalary = Number(employee.monthly_salary || 0);
  const isMonthly = employee.contract_type === "monthly" || monthlySalary > 0;

  // TES 13 §: part-time hourly rate = monthly salary / 159.
  const referenceHourlyRate = hourlyRate > 0
    ? hourlyRate
    : (isMonthly && monthlySalary > 0 ? monthlySalary / 159 : 0);

  // Hourly workers are paid for all base hours directly. Monthly workers receive the fixed
  // monthly salary; hours beyond the regular salary scope are added separately below.
  const basePay = isMonthly ? monthlySalary : hours.base_hours * hourlyRate;

  const extraWorkBasePay = isMonthly
    ? (overtime.additional_work_hours + overtime.overtime_hours) * referenceHourlyRate
    : 0;

  const eveningRate = Number(settings.evening_eur_per_hour || 0);
  const nightRate = Number(settings.night_eur_per_hour || 0);
  const eveningPay = hours.evening_hours * eveningRate;
  const nightPay = hours.night_hours * nightRate;

  // Sunday/holiday: base wage AND evening/night supplements are increased by 100%.
  const premium100BasePay = hours.premium_100_hours * referenceHourlyRate;
  const premium100SupplementPay =
    hours.premium_100_evening_hours * eveningRate +
    hours.premium_100_night_hours * nightRate;
  const premium100Pay = premium100BasePay + premium100SupplementPay;

  // Aatto after 15:00: +50% base wage, and +50% evening supplement for the evening overlap.
  const evePay =
    hours.eve_hours * referenceHourlyRate * 0.5 +
    hours.eve_evening_hours * eveningRate * 0.5;

  // Overtime: first 18 h above 120 h +50%, later hours +100%.
  // For hourly employees the basic wage for those hours is already in basePay.
  // For monthly employees the basic wage is included in extraWorkBasePay.
  const overtimePay =
    overtime.overtime_50_hours * referenceHourlyRate * 0.5 +
    overtime.overtime_100_hours * referenceHourlyRate;

  const gross =
    basePay + extraWorkBasePay + eveningPay + nightPay + premium100Pay +
    evePay + overtimePay + adjustmentsPay;

  return {
    employee,
    hours,
    contract_hours: overtime.contract_hours,
    additional_work_hours: overtime.additional_work_hours,
    overtime_50_hours: overtime.overtime_50_hours,
    overtime_100_hours: overtime.overtime_100_hours,
    overtime_hours: overtime.overtime_hours,
    bank_delta: overtime.bank_delta,
    bank_balance: round2(Number(employee.bank_hours || 0) + overtime.bank_delta),
    pay_basis: isMonthly ? "monthly" : "hourly",
    reference_hourly_rate: money2(referenceHourlyRate),
    monthly_salary: money2(monthlySalary),
    base_pay: money2(basePay),
    extra_work_base_pay: money2(extraWorkBasePay),
    evening_pay: money2(eveningPay),
    night_pay: money2(nightPay),
    premium_100_base_pay: money2(premium100BasePay),
    premium_100_supplement_pay: money2(premium100SupplementPay),
    premium_100_pay: money2(premium100Pay),
    eve_pay: money2(evePay),
    overtime_pay: money2(overtimePay),
    adjustments_pay: money2(adjustmentsPay),
    gross_pay: money2(gross),
  };
}

export type PayrollPeriodStatus = "open" | "closed";

export interface PayrollPeriodRecord {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  status: PayrollPeriodStatus;
  rows_snapshot: PayrollRow[];
  totals_snapshot: Record<string, number>;
  settings_snapshot: Partial<PayrollSettings>;
  closed_by: string | null;
  closed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPayrollPeriodRecord(
  restaurantId: string,
  start: string,
  end: string
): Promise<PayrollPeriodRecord | null> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();
  if (error) throw error;
  return data as PayrollPeriodRecord | null;
}

export async function listPayrollPeriodRecords(restaurantId: string): Promise<PayrollPeriodRecord[]> {
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("period_start", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data || []) as PayrollPeriodRecord[];
}

export async function closePayrollPeriod(input: {
  restaurantId: string;
  start: string;
  end: string;
  rows: PayrollRow[];
  totals: Record<string, number>;
  settings: PayrollSettings;
  userId?: string | null;
}): Promise<PayrollPeriodRecord> {
  const now = new Date().toISOString();
  const payload = {
    restaurant_id: input.restaurantId,
    period_start: input.start,
    period_end: input.end,
    status: "closed",
    rows_snapshot: input.rows,
    totals_snapshot: input.totals,
    settings_snapshot: input.settings,
    closed_by: input.userId || null,
    closed_at: now,
    reopened_by: null,
    reopened_at: null,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("payroll_periods")
    .upsert(payload, { onConflict: "restaurant_id,period_start,period_end" })
    .select("*")
    .single();
  if (error) throw error;
  return data as PayrollPeriodRecord;
}

export async function reopenPayrollPeriod(input: {
  restaurantId: string;
  start: string;
  end: string;
  userId?: string | null;
}): Promise<PayrollPeriodRecord> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payroll_periods")
    .update({
      status: "open",
      reopened_by: input.userId || null,
      reopened_at: now,
      updated_at: now,
    })
    .eq("restaurant_id", input.restaurantId)
    .eq("period_start", input.start)
    .eq("period_end", input.end)
    .select("*")
    .single();
  if (error) throw error;
  return data as PayrollPeriodRecord;
}

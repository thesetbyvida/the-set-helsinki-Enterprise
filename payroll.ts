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
  updated_at?: string;
}

export interface PayrollPeriod {
  start: string;
  end: string;
}

export interface PayrollRow {
  employee: Employee;
  hours: TesBreakdown;
  base_pay: number;
  evening_pay: number;
  night_pay: number;
  premium_100_pay: number;
  eve_pay: number;
  gross_pay: number;
}

export const defaultPayrollSettings = (restaurantId: string): PayrollSettings => ({
  restaurant_id: restaurantId,
  period_start_day: 21,
  evening_eur_per_hour: 0,
  night_eur_per_hour: 0,
  eve_eur_per_hour: 0,
});

export async function getPayrollSettings(restaurantId: string): Promise<PayrollSettings> {
  if (!supabase) return defaultPayrollSettings(restaurantId);
  const { data, error } = await supabase
    .from("payroll_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as PayrollSettings) : defaultPayrollSettings(restaurantId);
}

export async function savePayrollSettings(settings: PayrollSettings): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("payroll_settings").upsert({
    ...settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export function payrollPeriodForDate(date: Date, startDay = 21): PayrollPeriod {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  let start: Date;
  if (d.getDate() >= startDay) start = new Date(d.getFullYear(), d.getMonth(), startDay, 12);
  else start = new Date(d.getFullYear(), d.getMonth() - 1, startDay, 12);
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, startDay, 12);
  return { start: isoDate(start), end: isoDate(addDays(nextStart, -1)) };
}

export function movePayrollPeriod(period: PayrollPeriod, months: number, startDay = 21): PayrollPeriod {
  const current = parseIsoDate(period.start);
  return payrollPeriodForDate(new Date(current.getFullYear(), current.getMonth() + months, startDay, 12), startDay);
}

export async function listPayrollShifts(restaurantId: string, start: string, end: string): Promise<RotaShift[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rota_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("shift_date", start)
    .lte("shift_date", end)
    .order("shift_date");
  if (error) throw error;
  return (data || []) as RotaShift[];
}

export async function listPayrollSpecialDays(start: string, end: string): Promise<SpecialDay[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tes_special_days")
    .select("date,kind,label,premium_start,premium_end")
    .gte("date", start)
    .lte("date", end)
    .order("date");
  if (error) throw error;
  return (data || []) as SpecialDay[];
}

export function aggregatePayrollHours(shifts: RotaShift[], specialDays: SpecialDay[]): Map<string, TesBreakdown> {
  const out = new Map<string, TesBreakdown>();
  for (const shift of shifts) {
    const current = out.get(shift.employee_id) || emptyTes();
    out.set(shift.employee_id, addTes(current, calculateShiftTes(shift, specialDays)));
  }
  return out;
}

const money2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePayrollRow(employee: Employee, hours: TesBreakdown, settings: PayrollSettings): PayrollRow {
  const hourlyRate = Number(employee.hourly_rate || 0);
  // Monthly employees receive their configured monthly salary as base. Hourly employees
  // receive all paid base hours (worked + S + VL) at their hourly rate.
  const basePay = employee.contract_type === "monthly"
    ? Number(employee.monthly_salary || 0)
    : hours.base_hours * hourlyRate;
  const eveningPay = hours.evening_hours * Number(settings.evening_eur_per_hour || 0);
  const nightPay = hours.night_hours * Number(settings.night_eur_per_hour || 0);
  // Sunday and holiday are a 100% premium. premium_100_hours is a union, so a minute
  // that is both Sunday and holiday is not paid twice here.
  const premium100Pay = hours.premium_100_hours * hourlyRate;
  const evePay = hours.eve_hours * Number(settings.eve_eur_per_hour || 0);
  return {
    employee,
    hours,
    base_pay: money2(basePay),
    evening_pay: money2(eveningPay),
    night_pay: money2(nightPay),
    premium_100_pay: money2(premium100Pay),
    eve_pay: money2(evePay),
    gross_pay: money2(basePay + eveningPay + nightPay + premium100Pay + evePay),
  };
}

import { supabase } from "./supabase";
import { calculateShiftTes, emptyTes, addTes, type SpecialDay, type TesBreakdown } from "./tes";
import type { RotaShift } from "../types/app";

export interface EmployeeHourCalc {
  employee_id: string;
  breakdown: TesBreakdown;
}

export async function listSpecialDays(startDate: string, endDate: string): Promise<SpecialDay[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tes_special_days")
    .select("date,kind,label,premium_start,premium_end")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");
  if (error) throw error;
  return (data || []) as SpecialDay[];
}

export async function listShiftsForRange(
  restaurantId: string,
  startDate: string,
  endDate: string
): Promise<RotaShift[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rota_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .order("shift_date");
  if (error) throw error;
  return (data || []) as RotaShift[];
}

export function effectiveHourCalcShift(shift: RotaShift): RotaShift {
  if (!shift.actual_start_time || !shift.actual_end_time || !shift.actual_approved_at) return shift;
  return { ...shift, start_time: shift.actual_start_time, end_time: shift.actual_end_time };
}

export function calculateEmployees(shifts: RotaShift[], specialDays: SpecialDay[]): Map<string, TesBreakdown> {
  const result = new Map<string, TesBreakdown>();
  for (const shift of shifts) {
    const current = result.get(shift.employee_id) || emptyTes();
    result.set(shift.employee_id, addTes(current, calculateShiftTes(effectiveHourCalcShift(shift), specialDays)));
  }
  return result;
}

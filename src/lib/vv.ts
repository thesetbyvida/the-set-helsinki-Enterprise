import { supabase } from "./supabase";

export interface VvSettings {
  restaurant_id: string;
  hours_per_vv: number;
  max_vv_per_year: number;
  updated_at: string;
}

export interface VvAdjustment {
  id: string;
  employee_id: string;
  restaurant_id: string | null;
  effective_date: string;
  vv_delta: number;
  bank_hours_delta: number;
  note: string;
  created_by: string | null;
  created_at: string;
}

export async function getVvSettings(restaurantId: string): Promise<VvSettings> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("vv_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as VvSettings;
  return { restaurant_id: restaurantId, hours_per_vv: 200, max_vv_per_year: 9, updated_at: new Date().toISOString() };
}

export async function saveVvSettings(restaurantId: string, hoursPerVv: number, maxVv: number) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("vv_settings").upsert({
    restaurant_id: restaurantId,
    hours_per_vv: hoursPerVv,
    max_vv_per_year: maxVv,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listVvAdjustments(restaurantId: string, startDate: string, endDate: string): Promise<VvAdjustment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("vv_adjustments")
    .select("*")
    .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
    .gte("effective_date", startDate)
    .lte("effective_date", endDate)
    .order("effective_date", { ascending: false });
  if (error) throw error;
  return (data || []) as VvAdjustment[];
}

export async function addVvAdjustment(input: {
  employeeId: string;
  restaurantId: string;
  effectiveDate: string;
  vvDelta: number;
  bankHoursDelta: number;
  note: string;
}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("vv_adjustments").insert({
    employee_id: input.employeeId,
    restaurant_id: input.restaurantId,
    effective_date: input.effectiveDate,
    vv_delta: input.vvDelta,
    bank_hours_delta: input.bankHoursDelta,
    note: input.note,
    created_by: auth.user?.id || null,
  });
  if (error) throw error;
}

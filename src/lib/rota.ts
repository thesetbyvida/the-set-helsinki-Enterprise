import { supabase } from "./supabase";
import type { RotaPeriod, RotaShift } from "../types/app";

export type ShiftDraft = Pick<RotaShift, "start_time" | "end_time" | "code" | "note">;

export async function getOrCreateRotaPeriod(restaurantId: string, startDate: string): Promise<RotaPeriod> {
  const { data: existing, error: selectError } = await supabase
    .from("rota_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("start_date", startDate)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing as RotaPeriod;

  const start = parseIsoDate(startDate);
  const end = addDays(start, 20);
  const { data, error } = await supabase
    .from("rota_periods")
    .insert({
      restaurant_id: restaurantId,
      start_date: startDate,
      end_date: isoDate(end),
    })
    .select()
    .single();
  if (error) throw error;
  return data as RotaPeriod;
}

export async function findRotaPeriod(restaurantId: string, startDate: string): Promise<RotaPeriod | null> {
  const { data, error } = await supabase
    .from("rota_periods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("start_date", startDate)
    .maybeSingle();
  if (error) throw error;
  return (data as RotaPeriod | null) || null;
}

export async function listRotaShifts(periodId: string): Promise<RotaShift[]> {
  const { data, error } = await supabase
    .from("rota_shifts")
    .select("*")
    .eq("period_id", periodId)
    .order("shift_date", { ascending: true })
    .order("shift_slot", { ascending: true });
  if (error) throw error;
  return (data || []) as RotaShift[];
}

export async function saveRotaShift(
  period: RotaPeriod,
  employeeId: string,
  date: string,
  shiftSlot: number,
  draft: ShiftDraft
) {
  const code = draft.code.trim().toLowerCase();
  const hasContent = Boolean(draft.start_time || draft.end_time || code || draft.note.trim());

  if (!hasContent) {
    const { error } = await supabase
      .from("rota_shifts")
      .delete()
      .eq("period_id", period.id)
      .eq("employee_id", employeeId)
      .eq("shift_date", date)
      .eq("shift_slot", shiftSlot);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("rota_shifts").upsert(
    {
      period_id: period.id,
      restaurant_id: period.restaurant_id,
      employee_id: employeeId,
      shift_date: date,
      shift_slot: shiftSlot,
      start_time: draft.start_time || null,
      end_time: draft.end_time || null,
      code,
      note: draft.note.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period_id,employee_id,shift_date,shift_slot" }
  );
  if (error) throw error;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function mondayOf(date: Date): Date {
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(date, delta);
}

export function shiftHours(shift?: ShiftDraft): number {
  if (!shift) return 0;
  const code = (shift.code || "").trim().toLowerCase();
  if (code === "s" || code === "vl") return 7.5;
  if (code === "v" || code === "vp" || code === "vv") return 0;
  if (!shift.start_time || !shift.end_time) return 0;

  const [sh, sm] = shift.start_time.slice(0, 5).split(":").map(Number);
  const [eh, em] = shift.end_time.slice(0, 5).split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

export function displayTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

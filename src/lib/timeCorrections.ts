import { supabase } from "./supabase";

export type TimeCorrectionStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface TimeCorrectionRequest {
  id: string;
  employee_id: string;
  shift_id: string;
  restaurant_id: string;
  shift_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  proposed_start_time: string;
  proposed_end_time: string;
  reason: string | null;
  status: TimeCorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function submitTimeCorrection(input: {
  shift_id: string;
  proposed_start_time: string;
  proposed_end_time: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc("submit_time_correction", {
    p_shift_id: input.shift_id,
    p_proposed_start_time: input.proposed_start_time,
    p_proposed_end_time: input.proposed_end_time,
    p_reason: input.reason || null,
  });
  if (error) throw error;
  return data;
}

export async function cancelTimeCorrection(requestId: string) {
  const { error } = await supabase.rpc("cancel_time_correction", { p_request_id: requestId });
  if (error) throw error;
}

export async function listOwnTimeCorrections(employeeId: string, start: string, end: string): Promise<TimeCorrectionRequest[]> {
  const { data, error } = await supabase
    .from("time_correction_requests")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("shift_date", start)
    .lte("shift_date", end)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as TimeCorrectionRequest[];
}

export async function listPendingTimeCorrections(restaurantId: string, start: string, end: string): Promise<TimeCorrectionRequest[]> {
  const { data, error } = await supabase
    .from("time_correction_requests")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .gte("shift_date", start)
    .lte("shift_date", end)
    .order("shift_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as TimeCorrectionRequest[];
}

export async function reviewTimeCorrection(input: {
  request_id: string;
  status: "approved" | "rejected";
  review_note?: string;
}) {
  const { data, error } = await supabase.rpc("review_time_correction", {
    p_request_id: input.request_id,
    p_status: input.status,
    p_review_note: input.review_note || null,
  });
  if (error) throw error;
  return data;
}

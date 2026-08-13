import { supabase } from "./supabase";

export interface PosSale {
  id: string;
  restaurant_id: string;
  business_date: string;
  receipt_no: string | null;
  gross_amount: number;
  net_amount: number;
  source: string | null;
  created_at: string;
}

export interface PosSaleDraft {
  restaurant_id: string;
  business_date: string;
  receipt_no?: string;
  gross_amount: number;
  net_amount: number;
  source?: string;
}

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listPosSales(restaurantId: string, from: string, to: string) {
  const { data, error } = await client()
    .from("pos_sales")
    .select("id,restaurant_id,business_date,receipt_no,gross_amount,net_amount,source,created_at")
    .eq("restaurant_id", restaurantId)
    .gte("business_date", from)
    .lte("business_date", to)
    .order("business_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as PosSale[];
}

export async function addPosSale(draft: PosSaleDraft) {
  const { error } = await client().from("pos_sales").insert({
    restaurant_id: draft.restaurant_id,
    business_date: draft.business_date,
    receipt_no: draft.receipt_no?.trim() || null,
    gross_amount: Number(draft.gross_amount || 0),
    net_amount: Number(draft.net_amount || 0),
    source: draft.source?.trim() || "manual",
  });
  if (error) throw error;
}

export async function deletePosSale(id: string) {
  const { error } = await client().from("pos_sales").delete().eq("id", id);
  if (error) throw error;
}

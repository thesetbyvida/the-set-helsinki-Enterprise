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

export interface PosImportResult { imported: number; skipped: number; failed: number; }

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

export async function importPosSales(restaurantId: string, rows: PosSaleDraft[], source: string, fileName: string): Promise<PosImportResult> {
  const c = client();
  const { data: job, error: jobError } = await c.from('pos_import_jobs').insert({
    restaurant_id: restaurantId,
    source,
    status: 'running',
    file_name: fileName,
  }).select('id').single();
  if (jobError) throw jobError;

  try {
    const payload = rows.map(r => ({
      business_date: r.business_date,
      receipt_no: r.receipt_no?.trim() || null,
      gross_amount: Number(r.gross_amount || 0),
      net_amount: Number(r.net_amount || 0),
      source: r.source?.trim() || source,
    }));
    const { data, error } = await c.rpc('import_pos_sales_batch', {
      p_restaurant_id: restaurantId,
      p_source: source,
      p_rows: payload,
    });
    if (error) throw error;
    const result = (data || {}) as Partial<PosImportResult>;
    const finalResult: PosImportResult = {
      imported: Number(result.imported || 0),
      skipped: Number(result.skipped || 0),
      failed: Number(result.failed || 0),
    };
    await c.from('pos_import_jobs').update({
      status: 'completed', imported_rows: finalResult.imported,
      skipped_rows: finalResult.skipped, failed_rows: finalResult.failed,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    return finalResult;
  } catch (e) {
    await c.from('pos_import_jobs').update({ status: 'failed', failed_rows: rows.length, completed_at: new Date().toISOString() }).eq('id', job.id);
    throw e;
  }
}

export async function deletePosSale(id: string) {
  const { error } = await client().from("pos_sales").delete().eq("id", id);
  if (error) throw error;
}

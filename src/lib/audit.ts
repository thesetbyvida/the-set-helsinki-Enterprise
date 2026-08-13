import { supabase } from "./supabase";

export type AuditPayload = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  restaurant_id?: string | null;
  details?: Record<string, unknown> | null;
};

export async function audit(payload: AuditPayload) {
  if (!supabase) return;
  try {
    await supabase.from("audit_log").insert({
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id || null,
      restaurant_id: payload.restaurant_id || null,
      details: payload.details || null,
    });
  } catch {
    // Audit logging must never break user workflows.
  }
}

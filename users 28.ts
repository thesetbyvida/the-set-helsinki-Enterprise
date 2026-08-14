import { supabase } from "./supabase";
import type { AppRole, Profile, UserRestaurant } from "../types/app";

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
  restaurant_ids: string[];
}

export async function listProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active,created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function listUserRestaurants(): Promise<UserRestaurant[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("user_restaurants").select("user_id,restaurant_id");
  if (error) throw error;
  return (data || []) as UserRestaurant[];
}

export async function updateManagedProfile(
  id: string,
  values: { full_name: string; role: AppRole; is_active: boolean }
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", id);
  if (error) throw error;
}

export async function saveUserRestaurants(userId: string, restaurantIds: string[]): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error: deleteError } = await supabase
    .from("user_restaurants")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (!restaurantIds.length) return;

  const { error } = await supabase.from("user_restaurants").insert(
    restaurantIds.map((restaurant_id) => ({ user_id: userId, restaurant_id }))
  );
  if (error) throw error;
}

async function invokeAdminUsers(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createManagedUser(input: CreateUserInput): Promise<void> {
  await invokeAdminUsers({ action: "create_user", ...input });
}

export async function changeManagedPassword(userId: string, password: string): Promise<void> {
  await invokeAdminUsers({ action: "update_password", user_id: userId, password });
}

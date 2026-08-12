import { supabase } from "./supabase";
import type { Employee, EmployeeRestaurant } from "../types/app";

export type EmployeeInput = {
  employee_number: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  birth_date: string;
  job_title: string;
  contract_type: "112.5h" | "0h" | "monthly";
  contract_hours: number;
  hourly_rate: number;
  monthly_salary: number;
  bank_hours: number;
  active: boolean;
};

export async function listEmployees(): Promise<Employee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data || []) as Employee[];
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_number: input.employee_number || null,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      birth_date: input.birth_date || null,
      job_title: input.job_title || null,
      contract_type: input.contract_type,
      contract_hours: input.contract_hours,
      hourly_rate: input.hourly_rate,
      monthly_salary: input.monthly_salary,
      bank_hours: input.bank_hours,
      active: input.active,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<Employee> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("employees")
    .update({
      employee_number: input.employee_number || null,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      birth_date: input.birth_date || null,
      job_title: input.job_title || null,
      contract_type: input.contract_type,
      contract_hours: input.contract_hours,
      hourly_rate: input.hourly_rate,
      monthly_salary: input.monthly_salary,
      bank_hours: input.bank_hours,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function setEmployeeActive(id: string, active: boolean) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("employees")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}

export async function listEmployeeRestaurants(): Promise<EmployeeRestaurant[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("employee_restaurants").select("*");
  if (error) throw error;
  return (data || []) as EmployeeRestaurant[];
}

export async function saveEmployeeRestaurants(employeeId: string, restaurantIds: string[]) {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error: deleteError } = await supabase
    .from("employee_restaurants")
    .delete()
    .eq("employee_id", employeeId);
  if (deleteError) throw deleteError;

  if (!restaurantIds.length) return;

  const { error } = await supabase.from("employee_restaurants").insert(
    restaurantIds.map((restaurant_id, index) => ({
      employee_id: employeeId,
      restaurant_id,
      display_order: index + 1,
    }))
  );
  if (error) throw error;
}

export async function saveRestaurantEmployeeOrder(restaurantId: string, employeeIds: string[]) {
  if (!supabase) throw new Error("Supabase is not configured");

  // Keep the same order for this restaurant across all three rota weeks.
  // Updates are intentionally scoped by both restaurant_id and employee_id.
  const results = await Promise.all(
    employeeIds.map((employeeId, index) =>
      supabase
        .from("employee_restaurants")
        .update({ display_order: index + 1 })
        .eq("restaurant_id", restaurantId)
        .eq("employee_id", employeeId)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

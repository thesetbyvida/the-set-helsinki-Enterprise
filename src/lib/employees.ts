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
  can_edit_own_hours: boolean;
  time_edit_requires_approval: boolean;
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
      can_edit_own_hours: input.can_edit_own_hours,
      time_edit_requires_approval: input.time_edit_requires_approval,
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
      can_edit_own_hours: input.can_edit_own_hours,
      time_edit_requires_approval: input.time_edit_requires_approval,
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
  if (!restaurantId || !employeeIds.length) return;

  // Enterprise 3.2: save the complete order atomically through one RPC.
  // The database function validates that the caller is an active admin/super_admin,
  // then updates every display_order in a single transaction.
  const { error } = await supabase.rpc("set_restaurant_employee_order", {
    p_restaurant_id: restaurantId,
    p_employee_ids: employeeIds,
  });
  if (error) throw error;
}

export async function listRotaDirectory(): Promise<{ employees: Employee[]; assignments: EmployeeRestaurant[] }> {
  if (!supabase) return { employees: [], assignments: [] };
  const { data, error } = await supabase.rpc("rota_employee_directory");
  if (error) throw error;
  const rows = (data || []) as Array<{ id:string; name:string; job_title:string|null; active:boolean; restaurant_id:string; display_order:number }>;
  const byId = new Map<string, Employee>();
  const assignments: EmployeeRestaurant[] = [];
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        employee_number: null,
        name: row.name,
        email: null,
        phone: null,
        address: null,
        birth_date: null,
        job_title: row.job_title,
        contract_type: "0h",
        contract_hours: 0,
        hourly_rate: 0,
        monthly_salary: 0,
        bank_hours: 0,
        can_edit_own_hours: false,
        time_edit_requires_approval: true,
        active: row.active,
        created_at: "",
        updated_at: "",
      });
    }
    assignments.push({ employee_id: row.id, restaurant_id: row.restaurant_id, display_order: row.display_order });
  }
  return { employees: [...byId.values()], assignments };
}

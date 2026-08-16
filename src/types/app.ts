export type Language = "en" | "fi" | "es";
export type AppRole = "super_admin" | "admin" | "manager" | "employee";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  logo_url: string | null;
  opening_hours: Record<string, string>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRestaurant {
  user_id: string;
  restaurant_id: string;
}

export interface Employee {
  id: string;
  employee_number: string | null;
  name: string;
  email: string | null;
  auth_user_id?: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  job_title: string | null;
  contract_type: "112.5h" | "0h" | "monthly";
  contract_hours: number;
  hourly_rate: number;
  monthly_salary: number;
  bank_hours: number;
  can_edit_own_hours?: boolean;
  time_edit_requires_approval?: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRestaurant {
  employee_id: string;
  restaurant_id: string;
  display_order: number;
}

export interface RotaPeriod {
  id: string;
  restaurant_id: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RotaShift {
  id: string;
  period_id: string;
  restaurant_id: string;
  employee_id: string;
  shift_date: string;
  shift_slot: number;
  start_time: string | null;
  end_time: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  actual_approved_at?: string | null;
  actual_approved_by?: string | null;
  code: string;
  note: string;
  created_at: string;
  updated_at: string;
}

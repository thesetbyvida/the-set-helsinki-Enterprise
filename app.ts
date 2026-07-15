export type AppRole = "super_admin" | "admin" | "manager" | "employee";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at?: string;
}

export type Language = "es" | "en" | "fi";

export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  logo_url: string | null;
  opening_hours: Record<string, string> | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}


export type ContractType = "112.5h" | "0h" | "monthly";

export interface Employee {
  id: string;
  employee_number: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  job_title: string | null;
  contract_type: ContractType;
  contract_hours: number;
  hourly_rate: number;
  monthly_salary: number;
  bank_hours: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeRestaurant {
  employee_id: string;
  restaurant_id: string;
  display_order: number;
}

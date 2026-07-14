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

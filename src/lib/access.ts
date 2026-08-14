import type { AppRole } from "../types/app";

export type PageId =
  | "dashboard" | "restaurants" | "employees" | "users" | "rota" | "hourcalc"
  | "payroll" | "vv" | "reports" | "pos" | "production" | "audit"
  | "mywork" | "requests" | "settings";

const EMPLOYEE_PAGES = new Set<PageId>(["rota", "mywork", "requests"]);
const MANAGER_BLOCKED = new Set<PageId>(["users", "payroll", "reports", "production", "audit", "settings"]);

export function canOpenPage(role: AppRole | undefined, page: PageId): boolean {
  if (!role) return false;
  if (role === "employee") return EMPLOYEE_PAGES.has(page);
  if (role === "manager") return !MANAGER_BLOCKED.has(page);
  if (page === "users") return role === "super_admin";
  if (page === "audit") return role === "super_admin" || role === "admin";
  return true;
}

export function defaultPageForRole(role: AppRole | undefined): PageId {
  return role === "employee" ? "mywork" : "dashboard";
}

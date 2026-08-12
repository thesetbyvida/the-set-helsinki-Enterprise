import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import { formatError } from "../lib/errors";
import {
  createEmployee,
  deleteEmployee,
  listEmployeeRestaurants,
  listEmployees,
  saveEmployeeRestaurants,
  setEmployeeActive,
  updateEmployee,
  type EmployeeInput,
} from "../lib/employees";
import type { Employee, EmployeeRestaurant, Restaurant } from "../types/app";

function emptyForm(): EmployeeInput {
  return {
    employee_number: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    birth_date: "",
    job_title: "",
    contract_type: "112.5h",
    contract_hours: 112.5,
    hourly_rate: 0,
    monthly_salary: 0,
    bank_hours: 0,
    active: true,
  };
}

export function EmployeesPage() {
  const { profile, t, setError, setMessage } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [links, setLinks] = useState<EmployeeRestaurant[]>([]);
  const [form, setForm] = useState<EmployeeInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  async function refresh() {
    setLoading(true);
    try {
      const [employeeRows, restaurantRows, linkRows] = await Promise.all([
        listEmployees(),
        listRestaurants(),
        listEmployeeRestaurants(),
      ]);
      setEmployees(employeeRows);
      setRestaurants(restaurantRows);
      setLinks(linkRows);
    } catch (error) {
      setError(formatError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        String(employee.employee_number || "").toLowerCase().includes(query) ||
        String(employee.job_title || "").toLowerCase().includes(query);

      const matchesRestaurant =
        restaurantFilter === "all" ||
        links.some(
          (link) =>
            link.employee_id === employee.id &&
            link.restaurant_id === restaurantFilter
        );

      return matchesSearch && matchesRestaurant;
    });
  }, [employees, links, search, restaurantFilter]);

  function assignedRestaurantIds(employeeId: string) {
    return links
      .filter((link) => link.employee_id === employeeId)
      .sort((a, b) => a.display_order - b.display_order)
      .map((link) => link.restaurant_id);
  }

  function assignedRestaurantNames(employeeId: string) {
    return assignedRestaurantIds(employeeId)
      .map((id) => restaurants.find((restaurant) => restaurant.id === id)?.name)
      .filter(Boolean) as string[];
  }

  function beginEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      employee_number: employee.employee_number || "",
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      address: employee.address || "",
      birth_date: employee.birth_date || "",
      job_title: employee.job_title || "",
      contract_type: employee.contract_type,
      contract_hours: Number(employee.contract_hours || 0),
      hourly_rate: Number(employee.hourly_rate || 0),
      monthly_salary: Number(employee.monthly_salary || 0),
      bank_hours: Number(employee.bank_hours || 0),
      active: employee.active,
    });
    setSelectedRestaurants(assignedRestaurantIds(employee.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedRestaurants([]);
  }

  function toggleRestaurant(id: string) {
    setSelectedRestaurants((current) =>
      current.includes(id)
        ? current.filter((restaurantId) => restaurantId !== id)
        : [...current, id]
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (!canEdit) {
      setError(t.onlyAdminsEmployees);
      return;
    }

    try {
      let employee: Employee;
      if (editingId) employee = await updateEmployee(editingId, form);
      else employee = await createEmployee(form);

      await saveEmployeeRestaurants(employee.id, selectedRestaurants);
      setMessage(t.employeeSaved);
      cancelEdit();
      await refresh();
    } catch (error) {
      setError(formatError(error));
    }
  }

  async function toggleActive(employee: Employee) {
    if (!canEdit) return;
    try {
      await setEmployeeActive(employee.id, !employee.active);
      await refresh();
    } catch (error) {
      setError(formatError(error));
    }
  }

  async function remove(employee: Employee) {
    if (!canEdit) return;
    if (!window.confirm(t.confirmDeleteEmployee)) return;

    try {
      await deleteEmployee(employee.id);
      setMessage(t.employeeDeleted);
      await refresh();
    } catch (error) {
      setError(formatError(error));
    }
  }

  return (
    <div className="employees-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{t.employees}</h2>
            <p className="muted">
              {employees.filter((employee) => employee.active).length} {t.active.toLowerCase()}
            </p>
          </div>
          <div className="employee-filters">
            <input
              placeholder={t.searchEmployees}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={restaurantFilter}
              onChange={(event) => setRestaurantFilter(event.target.value)}
            >
              <option value="all">{t.allEmployees}</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : filteredEmployees.length === 0 ? (
          <p>{t.noEmployees}</p>
        ) : (
          <div className="employee-cards">
            {filteredEmployees.map((employee) => {
              const names = assignedRestaurantNames(employee.id);
              return (
                <article
                  className={`employee-card ${employee.active ? "" : "inactive"}`}
                  key={employee.id}
                >
                  <div className="employee-main">
                    <div className="employee-avatar">
                      {employee.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="employee-info">
                      <div className="employee-title-row">
                        <div>
                          <h3>{employee.name}</h3>
                          <p>{employee.job_title || "—"}</p>
                        </div>
                        <span className={`status-badge ${employee.active ? "active" : "inactive"}`}>
                          {employee.active ? t.active : t.inactive}
                        </span>
                      </div>

                      <div className="employee-metrics">
                        <div>
                          <span>{t.employeeNumber}</span>
                          <strong>{employee.employee_number || "—"}</strong>
                        </div>
                        <div>
                          <span>{t.contractType}</span>
                          <strong>
                            {employee.contract_type === "112.5h"
                              ? t.contract1125
                              : employee.contract_type === "0h"
                              ? t.contract0
                              : t.contractMonthly}
                          </strong>
                        </div>
                        <div>
                          <span>{t.contractHours}</span>
                          <strong>{Number(employee.contract_hours || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>{t.hourlyRate}</span>
                          <strong>€{Number(employee.hourly_rate || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>{t.bankHours}</span>
                          <strong>{Number(employee.bank_hours || 0).toFixed(2)}</strong>
                        </div>
                      </div>

                      <div className="employee-contact">
                        <span>{employee.email || "—"}</span>
                        <span>{employee.phone || "—"}</span>
                      </div>

                      <div className="badge-row">
                        {names.length
                          ? names.map((name) => (
                              <span className="badge" key={name}>
                                {name}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="employee-actions">
                      <button onClick={() => beginEdit(employee)}>{t.editEmployee}</button>
                      <button className="secondary" onClick={() => toggleActive(employee)}>
                        {employee.active ? t.deactivate : t.activate}
                      </button>
                      <button className="danger" onClick={() => remove(employee)}>
                        {t.delete}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel employee-form-panel">
        <h2>{editingId ? t.editEmployee : t.addEmployee}</h2>

        {!canEdit && <div className="alert">{t.onlyAdminsEmployees}</div>}

        <form className="employee-form" onSubmit={save}>
          <div className="form-columns">
            <label>
              {t.employeeNumber}
              <input
                value={form.employee_number}
                onChange={(event) =>
                  setForm({ ...form, employee_number: event.target.value })
                }
                disabled={!canEdit}
              />
            </label>

            <label>
              {t.employeeName}
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="form-columns">
            <label>
              {t.employeeEmail}
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                disabled={!canEdit}
              />
            </label>

            <label>
              {t.employeePhone}
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                disabled={!canEdit}
              />
            </label>
          </div>

          <label>
            {t.employeeAddress}
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              disabled={!canEdit}
            />
          </label>

          <div className="form-columns">
            <label>
              {t.birthDate}
              <input
                type="date"
                value={form.birth_date}
                onChange={(event) => setForm({ ...form, birth_date: event.target.value })}
                disabled={!canEdit}
              />
            </label>

            <label>
              {t.jobTitle}
              <input
                value={form.job_title}
                onChange={(event) => setForm({ ...form, job_title: event.target.value })}
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="form-columns">
            <label>
              {t.contractType}
              <select
                value={form.contract_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    contract_type: event.target.value as EmployeeInput["contract_type"],
                  })
                }
                disabled={!canEdit}
              >
                <option value="112.5h">{t.contract1125}</option>
                <option value="0h">{t.contract0}</option>
                <option value="monthly">{t.contractMonthly}</option>
              </select>
            </label>

            <label>
              {t.contractHours}
              <input
                type="number"
                step="0.01"
                value={form.contract_hours}
                onChange={(event) =>
                  setForm({ ...form, contract_hours: Number(event.target.value) })
                }
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="form-columns">
            <label>
              {t.hourlyRate}
              <input
                type="number"
                step="0.01"
                value={form.hourly_rate}
                onChange={(event) =>
                  setForm({ ...form, hourly_rate: Number(event.target.value) })
                }
                disabled={!canEdit}
              />
            </label>

            <label>
              {t.monthlySalary}
              <input
                type="number"
                step="0.01"
                value={form.monthly_salary}
                onChange={(event) =>
                  setForm({ ...form, monthly_salary: Number(event.target.value) })
                }
                disabled={!canEdit}
              />
            </label>
          </div>

          <label>
            {t.bankHours}
            <input
              type="number"
              step="0.01"
              value={form.bank_hours}
              onChange={(event) =>
                setForm({ ...form, bank_hours: Number(event.target.value) })
              }
              disabled={!canEdit}
            />
          </label>

          <fieldset disabled={!canEdit}>
            <legend>{t.assignedRestaurants}</legend>
            <div className="checks">
              {restaurants.map((restaurant) => (
                <label key={restaurant.id}>
                  <input
                    type="checkbox"
                    checked={selectedRestaurants.includes(restaurant.id)}
                    onChange={() => toggleRestaurant(restaurant.id)}
                  />
                  {restaurant.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
              disabled={!canEdit}
            />
            {t.active}
          </label>

          {canEdit && (
            <div className="form-actions">
              <button type="submit">{t.save}</button>
              {editingId && (
                <button type="button" className="secondary" onClick={cancelEdit}>
                  {t.cancel}
                </button>
              )}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

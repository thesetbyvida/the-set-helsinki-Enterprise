import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { listRestaurants } from "../lib/restaurants";
import {
  changeManagedPassword,
  createManagedUser,
  listProfiles,
  listUserRestaurants,
  saveUserRestaurants,
  updateManagedProfile,
} from "../lib/users";
import type { AppRole, Profile, Restaurant, UserRestaurant } from "../types/app";

const roles: AppRole[] = ["employee", "manager", "admin", "super_admin"];

export function UsersPage() {
  const { profile: currentProfile, t } = useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [assignments, setAssignments] = useState<UserRestaurant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("employee");
  const [newRestaurantIds, setNewRestaurantIds] = useState<string[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const canManage = currentProfile?.role === "super_admin" || currentProfile?.role === "admin";

  async function reload() {
    setError("");
    const [nextProfiles, nextRestaurants, nextAssignments] = await Promise.all([
      listProfiles(),
      listRestaurants(),
      listUserRestaurants(),
    ]);
    setProfiles(nextProfiles);
    setRestaurants(nextRestaurants);
    setAssignments(nextAssignments);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message || String(e)));
  }, []);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    assignments.forEach((row) => {
      if (!map.has(row.user_id)) map.set(row.user_id, new Set());
      map.get(row.user_id)!.add(row.restaurant_id);
    });
    return map;
  }, [assignments]);

  function toggleExisting(userId: string, restaurantId: string) {
    setAssignments((prev) => {
      const exists = prev.some((x) => x.user_id === userId && x.restaurant_id === restaurantId);
      if (exists) return prev.filter((x) => !(x.user_id === userId && x.restaurant_id === restaurantId));
      return [...prev, { user_id: userId, restaurant_id: restaurantId }];
    });
  }

  function toggleNew(restaurantId: string) {
    setNewRestaurantIds((prev) =>
      prev.includes(restaurantId) ? prev.filter((id) => id !== restaurantId) : [...prev, restaurantId]
    );
  }

  async function createUser() {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      setError(t.userRequiredFields);
      return;
    }
    if (newPassword.length < 8) {
      setError(t.passwordMinimum);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createManagedUser({
        full_name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        restaurant_ids: newRestaurantIds,
      });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("employee");
      setNewRestaurantIds([]);
      setMessage(t.userCreated);
      await reload();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(user: Profile) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateManagedProfile(user.id, {
        full_name: user.full_name || "",
        role: user.role,
        is_active: user.is_active,
      });
      await saveUserRestaurants(user.id, Array.from(assignmentMap.get(user.id) || []));
      setMessage(t.userSaved);
      await reload();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(userId: string) {
    const password = passwords[userId] || "";
    if (password.length < 8) {
      setError(t.passwordMinimum);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await changeManagedPassword(userId, password);
      setPasswords((prev) => ({ ...prev, [userId]: "" }));
      setMessage(t.passwordChangedAdmin);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function patchUser(id: string, patch: Partial<Profile>) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  if (!canManage) {
    return <section className="panel"><div className="alert">{t.onlyAdminsUsers}</div></section>;
  }

  return (
    <div className="users-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{t.users}</h2>
            <p className="muted">{t.usersDescription}</p>
          </div>
        </div>
        {error && <div className="alert">{error}</div>}
        {message && <div className="notice">{message}</div>}

        <div className="user-cards">
          {profiles.map((user) => {
            const isSelf = user.id === currentProfile?.id;
            return (
              <article className={`user-card ${!user.is_active ? "inactive" : ""}`} key={user.id}>
                <div className="user-card-grid">
                  <label>
                    {t.fullName}
                    <input
                      value={user.full_name || ""}
                      onChange={(e) => patchUser(user.id, { full_name: e.target.value })}
                    />
                  </label>
                  <label>
                    {t.email}
                    <input value={user.email || ""} disabled />
                  </label>
                  <label>
                    {t.role}
                    <select
                      value={user.role}
                      disabled={isSelf || (currentProfile?.role !== "super_admin" && user.role === "super_admin")}
                      onChange={(e) => patchUser(user.id, { role: e.target.value as AppRole })}
                    >
                      {roles
                        .filter((role) => currentProfile?.role === "super_admin" || role !== "super_admin")
                        .map((role) => <option value={role} key={role}>{role}</option>)}
                    </select>
                  </label>
                  <label>
                    {t.status}
                    <select
                      value={user.is_active ? "active" : "inactive"}
                      disabled={isSelf}
                      onChange={(e) => patchUser(user.id, { is_active: e.target.value === "active" })}
                    >
                      <option value="active">{t.active}</option>
                      <option value="inactive">{t.inactive}</option>
                    </select>
                  </label>
                </div>

                <fieldset className="restaurant-assignment-box">
                  <legend>{t.assignedRestaurants}</legend>
                  <div className="restaurant-checks">
                    {restaurants.map((restaurant) => (
                      <label className="checkbox-label" key={restaurant.id}>
                        <input
                          type="checkbox"
                          checked={assignmentMap.get(user.id)?.has(restaurant.id) || false}
                          onChange={() => toggleExisting(user.id, restaurant.id)}
                        />
                        <span>{restaurant.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="user-actions">
                  <button disabled={busy} onClick={() => saveUser(user)}>{t.saveUser}</button>
                  <input
                    className="password-input"
                    type="password"
                    placeholder={t.newPassword}
                    value={passwords[user.id] || ""}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))}
                  />
                  <button className="secondary" disabled={busy} onClick={() => changePassword(user.id)}>
                    {t.changePassword}
                  </button>
                </div>
              </article>
            );
          })}
          {!profiles.length && <p className="muted">{t.noUsers}</p>}
        </div>
      </section>

      <aside className="panel user-create-panel">
        <h2>{t.createUser}</h2>
        <div className="user-form">
          <label>{t.fullName}<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
          <label>{t.email}<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></label>
          <label>{t.password}<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <label>
            {t.role}
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)}>
              {roles
                .filter((role) => currentProfile?.role === "super_admin" || role !== "super_admin")
                .map((role) => <option value={role} key={role}>{role}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>{t.assignedRestaurants}</legend>
            <div className="restaurant-checks">
              {restaurants.map((restaurant) => (
                <label className="checkbox-label" key={restaurant.id}>
                  <input
                    type="checkbox"
                    checked={newRestaurantIds.includes(restaurant.id)}
                    onChange={() => toggleNew(restaurant.id)}
                  />
                  <span>{restaurant.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={busy} onClick={createUser}>{busy ? t.saving : t.createUser}</button>
          <div className="phase-card">{t.edgeFunctionRequired}</div>
        </div>
      </aside>
    </div>
  );
}

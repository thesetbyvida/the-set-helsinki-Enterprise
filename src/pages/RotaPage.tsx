import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { listRestaurants, listRotaRestaurants } from "../lib/restaurants";
import { listEmployeeRestaurants, listEmployees, listRotaDirectory, saveRestaurantEmployeeOrder } from "../lib/employees";
import { formatError } from "../lib/errors";
import {
  addDays,
  displayTime,
  findRotaPeriod,
  getOrCreateRotaPeriod,
  isoDate,
  listRotaShifts,
  mondayOf,
  parseIsoDate,
  saveRotaShift,
  shiftHours,
  type ShiftDraft,
} from "../lib/rota";
import type { Employee, EmployeeRestaurant, Restaurant, RotaPeriod } from "../types/app";

type ShiftMap = Record<string, ShiftDraft>;
type ActualShiftInfo = {
  id: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_approved_at: string | null;
  actual_approved_by: string | null;
};
type ActualShiftMap = Record<string, ActualShiftInfo>;
const EMPTY_SHIFT: ShiftDraft = { start_time: null, end_time: null, code: "", note: "" };
const CODES = ["", "s", "vl", "vv", "v", "vp"];
const MAX_SHIFTS_PER_DAY = 4;

function shiftKey(employeeId: string, date: string, slot = 1) {
  return `${employeeId}__${date}__${slot}`;
}

function parseShiftKey(key: string) {
  const [employeeId, date, slot] = key.split("__");
  return { employeeId, date, slot: Number(slot || 1) };
}

function hoursLabel(value: number) {
  return value ? value.toFixed(2).replace(/\.00$/, "") : "";
}

type RotaQaIssue = {
  employeeId: string;
  date: string;
  slot?: number;
  kind: "incomplete" | "zero_length" | "overlap" | "coded_time";
};

function minutesOf(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function timedInterval(shift: ShiftDraft): [number, number] | null {
  if (!shift.start_time || !shift.end_time || shift.start_time === shift.end_time) return null;
  const start = minutesOf(shift.start_time);
  let end = minutesOf(shift.end_time);
  if (end < start) end += 24 * 60;
  return [start, end];
}

function intervalsOverlap(a: [number, number], b: [number, number]) {
  // Compare the same-day interval and a shifted copy so overnight shifts are covered.
  return a[0] < b[1] && b[0] < a[1]
    || a[0] < b[1] + 1440 && b[0] + 1440 < a[1]
    || a[0] + 1440 < b[1] && b[0] < a[1] + 1440;
}

export function RotaPage() {
  const { profile, language, t } = useApp();
  const canEdit = Boolean(profile && ["super_admin", "admin", "manager"].includes(profile.role));
  const canReorder = Boolean(profile && ["super_admin", "admin"].includes(profile.role));
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeRestaurants, setEmployeeRestaurants] = useState<EmployeeRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [startDate, setStartDate] = useState(() => isoDate(mondayOf(new Date())));
  const [period, setPeriod] = useState<RotaPeriod | null>(null);
  const [shifts, setShifts] = useState<ShiftMap>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [visibleExtraSlots, setVisibleExtraSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "waiting" | "saving" | "saved" | "error">("idle");
  const [actualShifts, setActualShifts] = useState<ActualShiftMap>({});
  const [actualEditorKey, setActualEditorKey] = useState<string | null>(null);
  const [actualDraft, setActualDraft] = useState({ start: "", end: "", note: "" });
  const [savingActual, setSavingActual] = useState(false);
  const [printActual, setPrintActual] = useState(true);
  const [rotaEditMode, setRotaEditMode] = useState<"scheduled" | "actual">("scheduled");
  const [actualInlineDrafts, setActualInlineDrafts] = useState<Record<string, { start: string; end: string; note: string }>>({});
  const canEditActual = Boolean(profile && ["super_admin", "admin"].includes(profile.role));

  const locale = language === "fi" ? "fi-FI" : language === "en" ? "en-GB" : "es-ES";
  const addShiftLabel = language === "fi" ? "Lisää vuoro" : language === "es" ? "Agregar turno" : "Add shift";
  const removeShiftLabel = language === "fi" ? "Poista vuoro" : language === "es" ? "Eliminar turno" : "Remove shift";

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const restaurantData = profile?.role === "employee" ? await listRotaRestaurants() : await listRestaurants();
        const directory = profile?.role === "employee" ? await listRotaDirectory() : null;
        const [employeeData, assignmentData] = directory
          ? [directory.employees, directory.assignments]
          : await Promise.all([listEmployees(), listEmployeeRestaurants()]);
        const activeRestaurants = restaurantData.filter((r) => r.active);
        setRestaurants(activeRestaurants);
        setEmployees(employeeData.filter((e) => e.active));
        setEmployeeRestaurants(assignmentData);
        if (activeRestaurants.length) setRestaurantId((current) => current || activeRestaurants[0].id);
      } catch (e) {
        setError(formatError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.role]);

  const dates = useMemo(() => {
    const first = parseIsoDate(startDate);
    return Array.from({ length: 21 }, (_, index) => isoDate(addDays(first, index)));
  }, [startDate]);

  const restaurantEmployees = useMemo(() => {
    if (!restaurantId) return [];
    const order = new Map(
      employeeRestaurants
        .filter((item) => item.restaurant_id === restaurantId)
        .map((item) => [item.employee_id, item.display_order])
    );
    return employees
      .filter((employee) => order.has(employee.id))
      .sort((a, b) => (order.get(a.id) || 999) - (order.get(b.id) || 999) || a.name.localeCompare(b.name));
  }, [employees, employeeRestaurants, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");
        setDirty(new Set());
        setVisibleExtraSlots(new Set());
        setActualShifts({});
        setActualEditorKey(null);
        const found = await findRotaPeriod(restaurantId, startDate);
        setPeriod(found);
        if (!found) {
          setShifts({});
          return;
        }
        const rows = await listRotaShifts(found.id);
        const next: ShiftMap = {};
        const nextActual: ActualShiftMap = {};
        const extras = new Set<string>();
        for (const row of rows) {
          const slot = Number(row.shift_slot || 1);
          const key = shiftKey(row.employee_id, row.shift_date, slot);
          next[key] = {
            start_time: row.start_time ? displayTime(row.start_time) : null,
            end_time: row.end_time ? displayTime(row.end_time) : null,
            code: row.code || "",
            note: row.note || "",
          };
          nextActual[key] = {
            id: row.id,
            actual_start_time: row.actual_start_time ? displayTime(row.actual_start_time) : null,
            actual_end_time: row.actual_end_time ? displayTime(row.actual_end_time) : null,
            actual_approved_at: row.actual_approved_at || null,
            actual_approved_by: row.actual_approved_by || null,
          };
          if (slot > 1) extras.add(shiftKey(row.employee_id, row.shift_date, slot));
        }
        setShifts(next);
        setActualShifts(nextActual);
        setVisibleExtraSlots(extras);
      } catch (e) {
        setError(formatError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId, startDate]);

  function updateShift(employeeId: string, date: string, slot: number, patch: Partial<ShiftDraft>) {
    if (!canEdit) return;
    const key = shiftKey(employeeId, date, slot);
    setShifts((current) => ({ ...current, [key]: { ...(current[key] || EMPTY_SHIFT), ...patch } }));
    setDirty((current) => new Set(current).add(key));
    if (slot > 1) setVisibleExtraSlots((current) => new Set(current).add(key));
    setMessage("");
  }

  function slotsForCell(employeeId: string, date: string) {
    const result = [1];
    for (let slot = 2; slot <= MAX_SHIFTS_PER_DAY; slot += 1) {
      const key = shiftKey(employeeId, date, slot);
      const draft = shifts[key];
      const hasContent = Boolean(draft && (draft.start_time || draft.end_time || draft.code || draft.note));
      if (visibleExtraSlots.has(key) || hasContent) result.push(slot);
    }
    return result;
  }

  function addShift(employeeId: string, date: string) {
    if (!canEdit) return;
    const currentSlots = slotsForCell(employeeId, date);
    const nextSlot = Array.from({ length: MAX_SHIFTS_PER_DAY }, (_, i) => i + 1).find((slot) => !currentSlots.includes(slot));
    if (!nextSlot) return;
    const key = shiftKey(employeeId, date, nextSlot);
    setVisibleExtraSlots((current) => new Set(current).add(key));
    setShifts((current) => ({ ...current, [key]: current[key] || { ...EMPTY_SHIFT } }));
  }

  function removeShift(employeeId: string, date: string, slot: number) {
    if (!canEdit || slot === 1) return;
    const key = shiftKey(employeeId, date, slot);
    setShifts((current) => ({ ...current, [key]: { ...EMPTY_SHIFT } }));
    setVisibleExtraSlots((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setDirty((current) => new Set(current).add(key));
    setMessage("");
  }

  const qaIssues = useMemo<RotaQaIssue[]>(() => {
    const issues: RotaQaIssue[] = [];
    for (const employee of restaurantEmployees) {
      for (const date of dates) {
        const timed: Array<{ slot: number; interval: [number, number] }> = [];
        for (let slot = 1; slot <= MAX_SHIFTS_PER_DAY; slot += 1) {
          const shift = shifts[shiftKey(employee.id, date, slot)];
          if (!shift) continue;
          const code = (shift.code || "").trim().toLowerCase();
          const hasStart = Boolean(shift.start_time);
          const hasEnd = Boolean(shift.end_time);
          const hasAny = hasStart || hasEnd || Boolean(code) || Boolean(shift.note?.trim());
          if (!hasAny) continue;

          if (hasStart !== hasEnd) {
            issues.push({ employeeId: employee.id, date, slot, kind: "incomplete" });
            continue;
          }
          if (hasStart && hasEnd && shift.start_time === shift.end_time) {
            issues.push({ employeeId: employee.id, date, slot, kind: "zero_length" });
            continue;
          }
          if (["s", "vl", "vv", "v", "vp"].includes(code) && (hasStart || hasEnd)) {
            issues.push({ employeeId: employee.id, date, slot, kind: "coded_time" });
          }
          const interval = timedInterval(shift);
          if (interval && !code) timed.push({ slot, interval });
        }
        for (let i = 0; i < timed.length; i += 1) {
          for (let j = i + 1; j < timed.length; j += 1) {
            if (intervalsOverlap(timed[i].interval, timed[j].interval)) {
              issues.push({ employeeId: employee.id, date, slot: timed[j].slot, kind: "overlap" });
            }
          }
        }
      }
    }
    return issues;
  }, [dates, restaurantEmployees, shifts]);

  function cellHasQaIssue(employeeId: string, date: string) {
    return qaIssues.some((issue) => issue.employeeId === employeeId && issue.date === date);
  }

  function confirmDiscardChanges() {
    if (!dirty.size) return true;
    return window.confirm(language === "fi"
      ? "Tallentamattomia muutoksia on. Hylätäänkö ne?"
      : language === "es"
        ? "Hay cambios sin guardar. ¿Quieres descartarlos?"
        : "There are unsaved changes. Discard them?");
  }

  async function saveAll(options: { autosave?: boolean } = {}) {
    if (!canEdit || !restaurantId || !dirty.size || saving) return;
    if (qaIssues.length) {
      if (!options.autosave) {
        setError(language === "fi"
          ? `Korjaa rota ennen tallennusta (${qaIssues.length} ongelmaa).`
          : language === "es"
            ? `Corrige el rota antes de guardar (${qaIssues.length} problema${qaIssues.length === 1 ? "" : "s"}).`
            : `Fix the rota before saving (${qaIssues.length} issue${qaIssues.length === 1 ? "" : "s"}).`);
      }
      return;
    }

    const keysToSave = Array.from(dirty);
    const draftsToSave = new Map(keysToSave.map((key) => [key, { ...(shifts[key] || EMPTY_SHIFT) }]));

    try {
      setSaving(true);
      if (options.autosave) setAutosaveStatus("saving");
      setError("");
      const activePeriod = period || (await getOrCreateRotaPeriod(restaurantId, startDate));
      if (!period) setPeriod(activePeriod);
      await Promise.all(keysToSave.map((key) => {
        const { employeeId, date, slot } = parseShiftKey(key);
        return saveRotaShift(activePeriod, employeeId, date, slot, draftsToSave.get(key) || EMPTY_SHIFT);
      }));

      // Only clear keys whose value has not changed again while the save was running.
      setDirty((current) => {
        const next = new Set(current);
        for (const key of keysToSave) {
          const savedDraft = draftsToSave.get(key) || EMPTY_SHIFT;
          const currentDraft = shifts[key] || EMPTY_SHIFT;
          if (JSON.stringify(savedDraft) === JSON.stringify(currentDraft)) next.delete(key);
        }
        return next;
      });

      if (options.autosave) {
        setAutosaveStatus("saved");
      } else {
        setMessage(t.rotaSaved || "Rota saved.");
      }
    } catch (e) {
      setError(formatError(e));
      if (options.autosave) setAutosaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!canEdit || !restaurantId || !dirty.size || qaIssues.length || saving) {
      if (!dirty.size && autosaveStatus === "waiting") setAutosaveStatus("idle");
      return;
    }
    setAutosaveStatus("waiting");
    const timer = window.setTimeout(() => {
      void saveAll({ autosave: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [dirty, qaIssues.length, saving, canEdit, restaurantId, shifts]);

  useEffect(() => {
    if (autosaveStatus !== "saved") return;
    const timer = window.setTimeout(() => setAutosaveStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [autosaveStatus]);

  function changeStart(value: string) {
    if (!value || !confirmDiscardChanges()) return;
    setStartDate(isoDate(mondayOf(parseIsoDate(value))));
  }

  function changeRestaurant(value: string) {
    if (!confirmDiscardChanges()) return;
    setRestaurantId(value);
  }

  function moveWeeks(days: number) {
    if (!confirmDiscardChanges()) return;
    setStartDate(isoDate(addDays(parseIsoDate(startDate), days)));
  }

  async function applyEmployeeOrder(employeeIds: string[]) {
    if (!canReorder || !restaurantId || employeeIds.length < 2) return;
    const previousAssignments = employeeRestaurants;
    const position = new Map(employeeIds.map((id, index) => [id, index + 1]));
    setEmployeeRestaurants((current) =>
      current.map((item) =>
        item.restaurant_id === restaurantId && position.has(item.employee_id)
          ? { ...item, display_order: position.get(item.employee_id)! }
          : item
      )
    );
    try {
      setOrdering(true);
      setError("");
      await saveRestaurantEmployeeOrder(restaurantId, employeeIds);
      const freshAssignments = await listEmployeeRestaurants();
      setEmployeeRestaurants(freshAssignments);
      setMessage(language === "fi" ? "Työntekijöiden järjestys tallennettu." : language === "es" ? "Orden de empleados guardado." : "Employee order saved.");
    } catch (e) {
      setEmployeeRestaurants(previousAssignments);
      setError(formatError(e));
    } finally {
      setOrdering(false);
    }
  }

  function moveEmployee(employeeId: string, direction: -1 | 1) {
    const ids = restaurantEmployees.map((employee) => employee.id);
    const index = ids.indexOf(employeeId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void applyEmployeeOrder(ids);
  }

  function dropEmployee(targetEmployeeId: string) {
    if (!draggedEmployeeId || draggedEmployeeId === targetEmployeeId) {
      setDraggedEmployeeId(null);
      return;
    }
    const ids = restaurantEmployees.map((employee) => employee.id);
    const from = ids.indexOf(draggedEmployeeId);
    const to = ids.indexOf(targetEmployeeId);
    if (from < 0 || to < 0) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setDraggedEmployeeId(null);
    void applyEmployeeOrder(ids);
  }

  function openActualEditor(key: string) {
    const scheduled = shifts[key] || EMPTY_SHIFT;
    const actual = actualShifts[key];
    if (!actual?.id) {
      setError(language === "es" ? "Guarda primero el turno programado." : language === "fi" ? "Tallenna suunniteltu vuoro ensin." : "Save the scheduled shift first.");
      return;
    }
    setActualDraft({
      start: actual.actual_start_time || scheduled.start_time || "",
      end: actual.actual_end_time || scheduled.end_time || "",
      note: "",
    });
    setActualEditorKey(key);
    setError("");
  }

  async function saveActualHours(key: string) {
    if (!canEditActual) return;
    const actual = actualShifts[key];
    if (!actual?.id || !actualDraft.start || !actualDraft.end) return;
    if (actualDraft.start === actualDraft.end) {
      setError(language === "es" ? "La hora de entrada y salida no pueden ser iguales." : language === "fi" ? "Alku- ja loppuaika eivät voi olla samat." : "Start and end time cannot be equal.");
      return;
    }
    try {
      setSavingActual(true);
      setError("");
      const { error: rpcError } = await supabase.rpc("set_actual_shift_time", {
        p_shift_id: actual.id,
        p_actual_start_time: actualDraft.start,
        p_actual_end_time: actualDraft.end,
        p_note: actualDraft.note || null,
      });
      if (rpcError) throw rpcError;
      setActualShifts((current) => ({
        ...current,
        [key]: { ...current[key], actual_start_time: actualDraft.start, actual_end_time: actualDraft.end, actual_approved_at: new Date().toISOString(), actual_approved_by: profile?.id || null },
      }));
      setActualEditorKey(null);
      setMessage(language === "es" ? "Horas reales actualizadas." : language === "fi" ? "Toteutuneet tunnit päivitetty." : "Actual hours updated.");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSavingActual(false);
    }
  }

  function actualInlineDraft(key: string) {
    const scheduled = shifts[key] || EMPTY_SHIFT;
    const actual = actualShifts[key];
    return actualInlineDrafts[key] || {
      start: actual?.actual_start_time || scheduled.start_time || "",
      end: actual?.actual_end_time || scheduled.end_time || "",
      note: "",
    };
  }

  function updateActualInlineDraft(key: string, patch: Partial<{ start: string; end: string; note: string }>) {
    setActualInlineDrafts((current) => ({
      ...current,
      [key]: { ...actualInlineDraft(key), ...patch },
    }));
  }

  async function saveActualInlineHours(key: string) {
    if (!canEditActual) return;
    const actual = actualShifts[key];
    const draft = actualInlineDraft(key);
    if (!actual?.id) {
      setError(language === "es" ? "Guarda primero el turno programado." : language === "fi" ? "Tallenna suunniteltu vuoro ensin." : "Save the scheduled shift first.");
      return;
    }
    if (!draft.start || !draft.end) {
      setError(language === "es" ? "La hora real de entrada y salida son obligatorias." : language === "fi" ? "Toteutunut alku- ja loppuaika ovat pakollisia." : "Actual start and end time are required.");
      return;
    }
    if (draft.start === draft.end) {
      setError(language === "es" ? "La hora real de entrada y salida no pueden ser iguales." : language === "fi" ? "Toteutunut alku- ja loppuaika eivät voi olla samat." : "Actual start and end time cannot be equal.");
      return;
    }
    try {
      setSavingActual(true);
      setError("");
      const { error: rpcError } = await supabase.rpc("set_actual_shift_time", {
        p_shift_id: actual.id,
        p_actual_start_time: draft.start,
        p_actual_end_time: draft.end,
        p_note: draft.note || null,
      });
      if (rpcError) throw rpcError;
      setActualShifts((current) => ({
        ...current,
        [key]: {
          ...current[key],
          actual_start_time: draft.start,
          actual_end_time: draft.end,
          actual_approved_at: new Date().toISOString(),
          actual_approved_by: profile?.id || null,
        },
      }));
      setActualInlineDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessage(language === "es" ? "Horas reales guardadas; el turno programado no cambió." : language === "fi" ? "Toteutuneet tunnit tallennettu; suunniteltu vuoro ei muuttunut." : "Actual hours saved; scheduled shift was preserved.");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSavingActual(false);
    }
  }

  async function clearActualHours(key: string) {
    if (!canEditActual) return;
    const actual = actualShifts[key];
    if (!actual?.id) return;
    try {
      setSavingActual(true);
      setError("");
      const { error: rpcError } = await supabase.rpc("clear_actual_shift_time", { p_shift_id: actual.id });
      if (rpcError) throw rpcError;
      setActualShifts((current) => ({ ...current, [key]: { ...current[key], actual_start_time: null, actual_end_time: null, actual_approved_at: null, actual_approved_by: null } }));
      setActualEditorKey(null);
      setMessage(language === "es" ? "Se restablecieron las horas programadas." : language === "fi" ? "Suunnitellut tunnit palautettu." : "Scheduled hours restored.");
    } catch (e) {
      setError(formatError(e));
    } finally {
      setSavingActual(false);
    }
  }

  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId);

  if (loading && !restaurants.length) return <div className="panel">{t.loading || "Loading…"}</div>;

  return (
    <div className="rota-page">
      <div className="panel rota-toolbar no-print">
        <div>
          <h2>{t.rota}</h2>
          <p className="muted">{t.rotaDescription || "Three weeks, Monday to Sunday."}</p>
        </div>
        <div className="rota-toolbar-controls">
          <label>
            <span>{t.restaurant || t.restaurants}</span>
            <select value={restaurantId} onChange={(e) => changeRestaurant(e.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.periodStart || "Period start"}</span>
            <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} />
          </label>
          <button className="secondary" onClick={() => moveWeeks(-21)}>← {t.previous || "Previous"}</button>
          <button className="secondary" onClick={() => moveWeeks(21)}>{t.next || "Next"} →</button>
          {canEdit && <button disabled={saving || !dirty.size || qaIssues.length > 0} title={qaIssues.length ? (language === "es" ? "Corrige los errores de Rota QA antes de guardar" : language === "fi" ? "Korjaa Rota QA -virheet ennen tallennusta" : "Fix Rota QA issues before saving") : ""} onClick={() => void saveAll()}>{saving ? (t.saving || "Saving…") : `${t.save || "Save"}${dirty.size ? ` (${dirty.size})` : ""}`}</button>}
          {canEditActual && <div className="rota-edit-mode" role="group" aria-label="Rota edit mode">
            <button type="button" className={rotaEditMode === "scheduled" ? "active" : "secondary"} onClick={() => setRotaEditMode("scheduled")}>{language === "es" ? "Programado" : language === "fi" ? "Suunniteltu" : "Scheduled"}</button>
            <button type="button" className={rotaEditMode === "actual" ? "active" : "secondary"} onClick={() => setRotaEditMode("actual")}>{language === "es" ? "Horas reales" : language === "fi" ? "Toteutuneet" : "Actual hours"}</button>
          </div>}
          <label className="rota-print-actual-toggle">
            <input type="checkbox" checked={printActual} onChange={(e) => setPrintActual(e.target.checked)} />
            <span>{language === "es" ? "Imprimir horas reales" : language === "fi" ? "Tulosta toteutuneet" : "Print actual hours"}</span>
          </label>
          <button onClick={() => window.print()}>{t.print || "Print"}</button>
        </div>
      </div>

      {error && <div className="alert no-print">{error}</div>}
      {message && <div className="notice no-print">{message}</div>}
      {!canEdit && <div className="phase-card no-print">{t.rotaReadOnly || "Read-only rota. Managers and admins can edit shifts."}</div>}
      <div className="phase-card rota-tip no-print">
        <strong>Phase 6.5.2:</strong> {language === "fi" ? "Käytä Suunniteltu-tilaa julkaistun työvuoron muokkaukseen ja Toteutuneet-tilaa toteutuneiden tuntien korjaukseen ilman alkuperäisen vuoron korvaamista." : language === "es" ? "Usa Programado para modificar el horario publicado y Horas reales para corregir lo trabajado sin sobrescribir el Rota original." : "Use Scheduled to edit the published rota and Actual hours to correct worked time without overwriting the original shift."}
      </div>

      <div className={`rota-qa-card no-print ${qaIssues.length ? "has-errors" : "is-ready"}`}>
        <div>
          <strong>Rota QA: {qaIssues.length ? (language === "fi" ? "KORJATTAVA" : language === "es" ? "REVISAR" : "CHECK") : "✓ READY"}</strong>
          <span>{qaIssues.length
            ? (language === "fi" ? `${qaIssues.length} ongelmaa estää tallennuksen.` : language === "es" ? `${qaIssues.length} problema${qaIssues.length === 1 ? "" : "s"} impide${qaIssues.length === 1 ? "" : "n"} guardar.` : `${qaIssues.length} issue${qaIssues.length === 1 ? "" : "s"} block saving.`)
            : (language === "fi" ? "Vuorot läpäisevät perustarkistukset." : language === "es" ? "Los turnos pasan las comprobaciones básicas." : "Shifts pass the basic checks.")}
          </span>
        </div>
        <div className="rota-save-status">
          {qaIssues.length > 0 && dirty.size > 0 && <span className="rota-unsaved">{language === "fi" ? `${dirty.size} odottaa korjausta` : language === "es" ? `${dirty.size} pendiente${dirty.size === 1 ? "" : "s"} de corrección` : `${dirty.size} waiting for QA`}</span>}
          {!qaIssues.length && autosaveStatus === "waiting" && <span className="rota-autosave pending">{language === "fi" ? "Automaattitallennus…" : language === "es" ? "Autoguardado pendiente…" : "Autosave pending…"}</span>}
          {autosaveStatus === "saving" && <span className="rota-autosave saving">{language === "fi" ? "Tallennetaan…" : language === "es" ? "Guardando…" : "Saving…"}</span>}
          {autosaveStatus === "saved" && <span className="rota-autosave saved">{language === "fi" ? "✓ Tallennettu" : language === "es" ? "✓ Guardado" : "✓ Saved"}</span>}
          {autosaveStatus === "error" && <span className="rota-autosave failed">{language === "fi" ? "⚠ Ei tallennettu" : language === "es" ? "⚠ No guardado" : "⚠ Not saved"}</span>}
        </div>
      </div>

      <div className="print-rota-title">
        <h1>The Set Helsinki — {selectedRestaurant?.name || "Rota"}</h1>
        <p>{new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(parseIsoDate(startDate))} – {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(addDays(parseIsoDate(startDate), 20))}</p>
      </div>

      {restaurantEmployees.length === 0 ? (
        <div className="panel">{t.noRotaEmployees || "No active employees are assigned to this restaurant."}</div>
      ) : (
        <div className="rota-weeks">
          {[0, 1, 2].map((weekIndex) => {
            const weekDates = dates.slice(weekIndex * 7, weekIndex * 7 + 7);
            return (
              <section className="rota-week panel" key={weekIndex}>
                <div className="rota-week-heading">
                  <h3>{t.week || "Week"} {weekIndex + 1}</h3>
                  <span>{weekDates[0]} – {weekDates[6]}</span>
                </div>
                <div className="rota-table-scroll">
                  <table className="rota-table">
                    <thead>
                      <tr>
                        <th className="employee-col">{t.employeeName || "Employee"}</th>
                        {weekDates.map((date) => {
                          const d = parseIsoDate(date);
                          return (
                            <th key={date} className={d.getDay() === 0 ? "sunday" : ""}>
                              <span className="day-name">{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}</span>
                              <span>{new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(d)}</span>
                            </th>
                          );
                        })}
                        <th className="total-col">{t.total || "Total"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurantEmployees.map((employee) => {
                        const weekTotal = weekDates.reduce((sum, date) => {
                          return sum + slotsForCell(employee.id, date).reduce((daySum, slot) => daySum + shiftHours(shifts[shiftKey(employee.id, date, slot)]), 0);
                        }, 0);
                        return (
                          <tr key={employee.id}>
                            <th
                              className={`employee-col employee-name-cell ${draggedEmployeeId === employee.id ? "is-dragging" : ""}`}
                              draggable={canReorder && !ordering}
                              onDragStart={() => canReorder && setDraggedEmployeeId(employee.id)}
                              onDragEnd={() => setDraggedEmployeeId(null)}
                              onDragOver={(event) => { if (canReorder) event.preventDefault(); }}
                              onDrop={() => canReorder && dropEmployee(employee.id)}
                            >
                              <div className="employee-name-layout">
                                {canReorder && (
                                  <div className="employee-order-controls no-print" title={language === "fi" ? "Muuta järjestystä" : language === "es" ? "Cambiar orden" : "Change order"}>
                                    <span className="drag-handle" aria-hidden="true">☰</span>
                                    <button type="button" disabled={ordering || restaurantEmployees[0]?.id === employee.id} onClick={(event) => { event.stopPropagation(); moveEmployee(employee.id, -1); }} aria-label="Move employee up" title="Move up">↑</button>
                                    <button type="button" disabled={ordering || restaurantEmployees[restaurantEmployees.length - 1]?.id === employee.id} onClick={(event) => { event.stopPropagation(); moveEmployee(employee.id, 1); }} aria-label="Move employee down" title="Move down">↓</button>
                                  </div>
                                )}
                                <span>{employee.name}</span>
                              </div>
                            </th>
                            {weekDates.map((date) => {
                              const slots = slotsForCell(employee.id, date);
                              const dayTotal = slots.reduce((sum, slot) => sum + shiftHours(shifts[shiftKey(employee.id, date, slot)]), 0);
                              const cellDirty = slots.some((slot) => dirty.has(shiftKey(employee.id, date, slot)));
                              return (
                                <td key={date} className={`${cellDirty ? "dirty " : ""}${cellHasQaIssue(employee.id, date) ? "qa-error" : ""}`.trim()}>
                                  <div className="multi-shift-editor no-print">
                                    {slots.map((slot) => {
                                      const key = shiftKey(employee.id, date, slot);
                                      const shift = shifts[key] || EMPTY_SHIFT;
                                      const hours = shiftHours(shift);
                                      return (
                                        <div className={`shift-editor ${slot > 1 ? "extra-shift" : ""}`} key={slot}>
                                          {slot > 1 && (
                                            <div className="shift-slot-heading">
                                              <span>{language === "fi" ? `Vuoro ${slot}` : language === "es" ? `Turno ${slot}` : `Shift ${slot}`}</span>
                                              <button type="button" className="icon-danger" title={removeShiftLabel} aria-label={removeShiftLabel} onClick={() => removeShift(employee.id, date, slot)}>×</button>
                                            </div>
                                          )}
                                          {rotaEditMode === "scheduled" || !canEditActual ? <>
                                            <div className="scheduled-edit-label">{language === "es" ? "Programado" : language === "fi" ? "Suunniteltu" : "Scheduled"}</div>
                                            <div className="shift-time-row">
                                              <input aria-label={`Start ${slot}`} type="time" value={shift.start_time || ""} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, slot, { start_time: e.target.value || null })} />
                                              <span>–</span>
                                              <input aria-label={`End ${slot}`} type="time" value={shift.end_time || ""} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, slot, { end_time: e.target.value || null })} />
                                            </div>
                                            <div className="shift-meta-row">
                                              <select aria-label={`Code ${slot}`} value={shift.code} disabled={!canEdit} onChange={(e) => updateShift(employee.id, date, slot, { code: e.target.value })}>
                                                {CODES.map((code) => <option key={code} value={code}>{code ? code.toUpperCase() : (t.code || "Code")}</option>)}
                                              </select>
                                              <input aria-label={`Note ${slot}`} type="text" value={shift.note} disabled={!canEdit} placeholder={t.note || "Note"} onChange={(e) => updateShift(employee.id, date, slot, { note: e.target.value })} />
                                            </div>
                                            <small>{hoursLabel(hours)}{hours ? " h" : ""}</small>
                                          </> : (() => {
                                            const actual = actualShifts[key];
                                            if (!actual?.id) return <div className="actual-inline-empty">{language === "es" ? "Guarda primero el turno programado." : language === "fi" ? "Tallenna suunniteltu vuoro ensin." : "Save the scheduled shift first."}</div>;
                                            const draft = actualInlineDraft(key);
                                            const hasActual = Boolean(actual.actual_start_time && actual.actual_end_time && actual.actual_approved_at);
                                            return <div className="actual-inline-editor">
                                              <div className="scheduled-reference"><span>{language === "es" ? "Programado" : language === "fi" ? "Suunniteltu" : "Scheduled"}</span><strong>{shift.start_time && shift.end_time ? `${displayTime(shift.start_time)}–${displayTime(shift.end_time)}` : "—"}</strong></div>
                                              <div className="actual-inline-label">{language === "es" ? "Horas reales" : language === "fi" ? "Toteutuneet" : "Actual hours"}</div>
                                              <div className="shift-time-row">
                                                <input aria-label={`Actual start ${slot}`} type="time" value={draft.start} onChange={(e) => updateActualInlineDraft(key, { start: e.target.value })} />
                                                <span>–</span>
                                                <input aria-label={`Actual end ${slot}`} type="time" value={draft.end} onChange={(e) => updateActualInlineDraft(key, { end: e.target.value })} />
                                              </div>
                                              <input className="actual-inline-note" type="text" placeholder={language === "es" ? "Motivo / nota" : language === "fi" ? "Syy / huomautus" : "Reason / note"} value={draft.note} onChange={(e) => updateActualInlineDraft(key, { note: e.target.value })} />
                                              <div className="actual-inline-actions">
                                                <button type="button" className="small" disabled={savingActual} onClick={() => void saveActualInlineHours(key)}>{language === "es" ? "Guardar real" : language === "fi" ? "Tallenna toteutunut" : "Save actual"}</button>
                                                {hasActual && <button type="button" className="small secondary" disabled={savingActual} onClick={() => void clearActualHours(key)}>{language === "es" ? "Usar programado" : language === "fi" ? "Käytä suunniteltua" : "Use scheduled"}</button>}
                                              </div>
                                              {hasActual && <div className="actual-hours-approved"><strong>{language === "es" ? "Real aprobado" : language === "fi" ? "Hyväksytty toteutunut" : "Approved actual"}: {actual.actual_start_time}–{actual.actual_end_time} ✓</strong></div>}
                                            </div>;
                                          })()}
                                          {rotaEditMode === "scheduled" && (() => {
                                            const actual = actualShifts[key];
                                            const hasActual = Boolean(actual?.actual_start_time && actual?.actual_end_time && actual?.actual_approved_at);
                                            if (!actual?.id) return null;
                                            return (
                                              <div className="actual-hours-box">
                                                {hasActual && <div className="actual-hours-approved"><strong>{language === "es" ? "Real" : language === "fi" ? "Toteutunut" : "Actual"}: {actual.actual_start_time}–{actual.actual_end_time} ✓</strong></div>}
                                                {canEditActual && actualEditorKey !== key && <button type="button" className="small secondary actual-edit-button" onClick={() => openActualEditor(key)}>{hasActual ? (language === "es" ? "Editar horas reales" : language === "fi" ? "Muokkaa toteutuneita" : "Edit actual hours") : (language === "es" ? "Añadir horas reales" : language === "fi" ? "Lisää toteutuneet" : "Add actual hours")}</button>}
                                                {canEditActual && actualEditorKey === key && <div className="actual-hours-editor">
                                                  <div className="shift-time-row"><input type="time" value={actualDraft.start} onChange={(e) => setActualDraft((d) => ({ ...d, start: e.target.value }))}/><span>–</span><input type="time" value={actualDraft.end} onChange={(e) => setActualDraft((d) => ({ ...d, end: e.target.value }))}/></div>
                                                  <input type="text" placeholder={language === "es" ? "Motivo / nota" : language === "fi" ? "Syy / huomautus" : "Reason / note"} value={actualDraft.note} onChange={(e) => setActualDraft((d) => ({ ...d, note: e.target.value }))}/>
                                                  <div className="actual-hours-actions"><button type="button" className="small" disabled={savingActual} onClick={() => void saveActualHours(key)}>{language === "es" ? "Guardar real" : language === "fi" ? "Tallenna toteutunut" : "Save actual"}</button><button type="button" className="small secondary" disabled={savingActual} onClick={() => setActualEditorKey(null)}>{language === "es" ? "Cancelar" : language === "fi" ? "Peruuta" : "Cancel"}</button>{hasActual && <button type="button" className="small danger" disabled={savingActual} onClick={() => void clearActualHours(key)}>{language === "es" ? "Usar programado" : language === "fi" ? "Käytä suunniteltua" : "Use scheduled"}</button>}</div>
                                                </div>}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                    {canEdit && slots.length < MAX_SHIFTS_PER_DAY && (
                                      <button type="button" className="add-shift-button" onClick={() => addShift(employee.id, date)}>+ {language === "es" ? "Turno" : language === "fi" ? "Vuoro" : "Shift"}</button>
                                    )}
                                    {dayTotal > 0 && slots.length > 1 && <div className="day-shift-total">{language === "es" ? "Día" : language === "fi" ? "Päivä" : "Day"}: {hoursLabel(dayTotal)} h</div>}
                                  </div>
                                  <div className="print-shift-list">
                                    {slots.map((slot) => {
                                      const shift = shifts[shiftKey(employee.id, date, slot)] || EMPTY_SHIFT;
                                      const hasPrintContent = Boolean(shift.start_time || shift.end_time || shift.code || shift.note);
                                      if (!hasPrintContent) return null;
                                      return (
                                        <div className="print-shift" key={slot}>
                                          {shift.start_time && shift.end_time && <strong>{displayTime(shift.start_time)}–{displayTime(shift.end_time)}</strong>}
                                          {printActual && (() => { const actual = actualShifts[shiftKey(employee.id, date, slot)]; return actual?.actual_start_time && actual?.actual_end_time && actual?.actual_approved_at ? <span className="print-actual">Actual: {actual.actual_start_time}–{actual.actual_end_time}</span> : null; })()}
                                          {shift.code && <span className="print-code">{shift.code.toUpperCase()}</span>}
                                          {shift.note && <span className="print-note">{shift.note}</span>}
                                        </div>
                                      );
                                    })}
                                    {slots.length > 1 && dayTotal > 0 && <span className="print-day-total">{hoursLabel(dayTotal)} h</span>}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="total-col"><strong>{hoursLabel(weekTotal)} h</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

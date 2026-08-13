import type { RotaShift } from "../types/app";
import { addDays, isoDate, parseIsoDate } from "./rota";

export type SpecialDayKind = "holiday" | "eve";

export interface SpecialDay {
  date: string;
  kind: SpecialDayKind;
  label: string;
  premium_start: string;
  premium_end: string;
}

export interface TesBreakdown {
  base_hours: number;
  worked_hours: number;
  evening_hours: number;
  night_hours: number;
  sunday_hours: number;
  holiday_hours: number;
  premium_100_hours: number;
  premium_100_evening_hours: number;
  premium_100_night_hours: number;
  eve_hours: number;
  eve_evening_hours: number;
  sick_hours: number;
  vacation_hours: number;
  vv_days: number;
  unpaid_leave_days: number;
}

const ZERO: TesBreakdown = {
  base_hours: 0,
  worked_hours: 0,
  evening_hours: 0,
  night_hours: 0,
  sunday_hours: 0,
  holiday_hours: 0,
  premium_100_hours: 0,
  premium_100_evening_hours: 0,
  premium_100_night_hours: 0,
  eve_hours: 0,
  eve_evening_hours: 0,
  sick_hours: 0,
  vacation_hours: 0,
  vv_days: 0,
  unpaid_leave_days: 0,
};

function minutes(value: string | null | undefined) {
  if (!value) return 0;
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function inClockRange(minuteOfDay: number, start: number, end: number) {
  if (start === end) return true;
  if (end > start) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

/**
 * Splits a shift minute-by-minute so midnight, Sunday, holiday, aatto and
 * evening/night boundaries remain deterministic.
 *
 * The Set Helsinki house rules retained from the existing application:
 * - Evening: 18:00–24:00
 * - Night: 00:00–06:00
 * - Saturday -> Sunday: minutes after 00:00 become Sunday.
 * - Sunday -> Monday: Sunday premium follows the whole overnight shift.
 * - S and VL create 7.5 paid base hours; VV/V/VP do not create worked hours.
 *
 * Phase 4.4 also records overlap hours so payroll can correctly double the
 * evening/night supplements on Sunday/holiday work and calculate aatto as a
 * percentage rather than a fixed euro amount.
 */
export function calculateShiftTes(
  shift: Pick<RotaShift, "shift_date" | "start_time" | "end_time" | "code">,
  specialDays: SpecialDay[] = []
): TesBreakdown {
  const result = { ...ZERO };
  const code = (shift.code || "").trim().toLowerCase();

  if (code === "s") {
    result.base_hours = 7.5;
    result.sick_hours = 7.5;
    return result;
  }
  if (code === "vl") {
    result.base_hours = 7.5;
    result.vacation_hours = 7.5;
    return result;
  }
  if (code === "vv") {
    result.vv_days = 1;
    return result;
  }
  if (code === "v" || code === "vp") {
    result.unpaid_leave_days = 1;
    return result;
  }
  if (!shift.start_time || !shift.end_time) return result;

  const startMinute = minutes(shift.start_time);
  let endMinute = minutes(shift.end_time);
  if (endMinute < startMinute) endMinute += 1440;
  const totalMinutes = Math.max(0, endMinute - startMinute);
  if (!totalMinutes) return result;

  const startDate = parseIsoDate(shift.shift_date);
  const startIsSunday = startDate.getDay() === 0;
  const holidayMinutes = new Set<number>();
  const sundayMinutes = new Set<number>();
  const premium100Minutes = new Set<number>();

  for (let offset = 0; offset < totalMinutes; offset += 1) {
    const absolute = startMinute + offset;
    const dayOffset = Math.floor(absolute / 1440);
    const minuteOfDay = absolute % 1440;
    const currentDate = addDays(startDate, dayOffset);
    const currentIso = isoDate(currentDate);
    const isEvening = minuteOfDay >= 18 * 60;
    const isNight = minuteOfDay < 6 * 60;

    if (isEvening) result.evening_hours += 1 / 60;
    if (isNight) result.night_hours += 1 / 60;

    const sunday = startIsSunday || currentDate.getDay() === 0;
    if (sunday) sundayMinutes.add(offset);

    const dayRules = specialDays.filter((item) => item.date === currentIso);
    let holiday = false;
    let eve = false;

    for (const rule of dayRules) {
      const rangeStart = minutes(rule.premium_start || "00:00");
      const rangeEnd = minutes(rule.premium_end || "00:00");
      if (!inClockRange(minuteOfDay, rangeStart, rangeEnd)) continue;
      if (rule.kind === "holiday") holiday = true;
      if (rule.kind === "eve") eve = true;
    }

    if (holiday) holidayMinutes.add(offset);

    // TES: aatto premium is not paid when the eve itself falls on a holiday.
    if (eve && !holiday) {
      result.eve_hours += 1 / 60;
      if (isEvening) result.eve_evening_hours += 1 / 60;
    }

    if (sunday || holiday) {
      premium100Minutes.add(offset);
      if (isEvening) result.premium_100_evening_hours += 1 / 60;
      if (isNight) result.premium_100_night_hours += 1 / 60;
    }
  }

  result.worked_hours = totalMinutes / 60;
  result.base_hours = result.worked_hours;
  result.sunday_hours = sundayMinutes.size / 60;
  result.holiday_hours = holidayMinutes.size / 60;
  result.premium_100_hours = premium100Minutes.size / 60;

  for (const key of [
    "base_hours",
    "worked_hours",
    "evening_hours",
    "night_hours",
    "sunday_hours",
    "holiday_hours",
    "premium_100_hours",
    "premium_100_evening_hours",
    "premium_100_night_hours",
    "eve_hours",
    "eve_evening_hours",
    "sick_hours",
    "vacation_hours",
  ] as const) {
    result[key] = round2(result[key]);
  }

  return result;
}

export function addTes(a: TesBreakdown, b: TesBreakdown): TesBreakdown {
  const out = { ...ZERO };
  for (const key of Object.keys(out) as Array<keyof TesBreakdown>) {
    out[key] = round2(a[key] + b[key]);
  }
  return out;
}

export function emptyTes(): TesBreakdown {
  return { ...ZERO };
}

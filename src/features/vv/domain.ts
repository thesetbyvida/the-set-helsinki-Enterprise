export function vvEarned(workedHours: number, hoursPerVv = 200, maxPerYear = 9) {
  if (hoursPerVv <= 0) return 0;
  return Math.min(maxPerYear, Math.floor(Math.max(0, workedHours) / hoursPerVv));
}

export function vvBalance(earned: number, used: number, adjustment = 0) {
  return earned + adjustment - used;
}

export function hoursToNextVv(workedHours: number, earned: number, hoursPerVv = 200, maxPerYear = 9) {
  if (earned >= maxPerYear) return null;
  return Math.max(0, (earned + 1) * hoursPerVv - workedHours);
}

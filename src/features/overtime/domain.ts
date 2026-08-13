export function overtimeForPeriod(workedHours: number, contractHours: number) {
  const worked = Math.max(0, Number(workedHours || 0));
  const contract = Math.max(0, Number(contractHours || 0));
  return {
    overtimeHours: Math.max(0, worked - contract),
    underHours: Math.max(0, contract - worked),
    difference: worked - contract,
  };
}

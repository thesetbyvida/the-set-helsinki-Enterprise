export function hourBankBalance(baseBalance: number, manualDelta = 0) {
  return Number(baseBalance || 0) + Number(manualDelta || 0);
}

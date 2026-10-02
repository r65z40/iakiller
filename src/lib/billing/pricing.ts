/** Calcul pur (utilisable côté client) de l'économie annuelle à partir des prix réels. */
export function annualSaving(monthlyCents: number, yearlyCents: number) {
  const monthlyEquivalent = Math.round(yearlyCents / 12);
  const fullYear = monthlyCents * 12;
  const percent = fullYear > 0 ? Math.floor((1 - yearlyCents / fullYear) * 100) : 0;
  return { monthlyEquivalent, savingCents: fullYear - yearlyCents, percent };
}

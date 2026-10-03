/** Calcul pur (utilisable côté client) de l'économie annuelle à partir des prix réels. */
export function annualSaving(monthlyCents: number, yearlyCents: number) {
  const monthlyEquivalent = Math.round(yearlyCents / 12);
  const fullYear = monthlyCents * 12;
  const percent = fullYear > 0 ? Math.floor((1 - yearlyCents / fullYear) * 100) : 0;
  return { monthlyEquivalent, savingCents: fullYear - yearlyCents, percent };
}

/** Prix annuel proposé à partir du mensuel et d'une remise de référence (arrondi à l'euro). */
export function suggestedAnnualCents(monthlyCents: number, discountPercent: number) {
  return Math.round((monthlyCents * 12 * (1 - discountPercent / 100)) / 100) * 100;
}

/**
 * Régime de collecte des statistiques (voir docs/STATISTIQUES.md).
 * - ANALYTICS_MODE=off      : aucune collecte.
 * - ANALYTICS_MODE=minimal  : (défaut) mesure sans cookie ni stockage sur l'appareil,
 *   sans identifiant persistant, sans adresse IP conservée.
 * - ANALYTICS_REQUIRE_CONSENT=true : aucune mesure avant accord explicite du visiteur.
 *   Le choix par défaut doit être validé juridiquement (CNIL : l'exemption de
 *   consentement pour la mesure d'audience est conditionnelle).
 */
export function analyticsConfig() {
  const mode = process.env.ANALYTICS_MODE === "off" ? "off" : "minimal";
  return {
    enabled: mode !== "off",
    requireConsent: process.env.ANALYTICS_REQUIRE_CONSENT === "true",
    rawRetentionDays: Number(process.env.ANALYTICS_RAW_RETENTION_DAYS ?? 395),
  };
}

const UTM_RE = /[^a-z0-9._\- ]/g;
export function sanitizeUtm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(UTM_RE, "").trim().slice(0, 60);
  return s || null;
}

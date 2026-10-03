import { settingsSync } from "@/lib/settings/store";

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
  // Régime réglé dans l'administration (défaut : variables d'environnement ci-dessus).
  const s = settingsSync();
  return {
    enabled: s.analytics.mode !== "off",
    requireConsent: s.analytics.mode === "consent",
    rawRetentionDays: s.retention.analyticsRawDays,
  };
}

const UTM_RE = /[^a-z0-9._\- ]/g;
export function sanitizeUtm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(UTM_RE, "").trim().slice(0, 60);
  return s || null;
}

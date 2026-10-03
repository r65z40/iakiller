/**
 * Règles de sauvegarde pures (sans base ni réseau), testées unitairement.
 * Rétention « grand-père / père / fils » : on conserve la sauvegarde la plus récente de
 * chacun des N derniers jours, des N dernières semaines et des N derniers mois
 * (calendrier Europe/Paris). La sauvegarde la plus récente est toujours conservée.
 */

export interface RetentionPolicy {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
}

export interface BackupRef {
  id: string;
  startedAt: Date;
}

const dayFormat = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour civil à Paris, AAAA-MM-JJ. */
export function parisDayKey(d: Date): string {
  return dayFormat.format(d);
}

/** Semaine ISO (AAAA-Wnn) du jour civil donné. */
export function isoWeekKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // jeudi de la même semaine
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function selectRetained(backups: BackupRef[], policy: RetentionPolicy): Set<string> {
  const sorted = [...backups].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const keep = new Set<string>();
  if (sorted[0]) keep.add(sorted[0].id);
  const bucket = (keyOf: (b: BackupRef) => string, count: number) => {
    const seen = new Set<string>();
    for (const b of sorted) {
      if (seen.size >= count) break;
      const k = keyOf(b);
      if (seen.has(k)) continue;
      seen.add(k);
      keep.add(b.id);
    }
  };
  bucket((b) => parisDayKey(b.startedAt), policy.keepDaily);
  bucket((b) => isoWeekKey(parisDayKey(b.startedAt)), policy.keepWeekly);
  bucket((b) => parisDayKey(b.startedAt).slice(0, 7), policy.keepMonthly);
  return keep;
}

/** Une sauvegarde est due si la dernière réussie date d'au moins la fréquence (marge de 10 min pour le cron). */
export function isBackupDue(lastSuccessAt: Date | null, frequencyHours: number, now = new Date()): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - lastSuccessAt.getTime() >= frequencyHours * 3600_000 - 10 * 60_000;
}

/** Alerte si aucune sauvegarde réussie depuis deux fois la fréquence (au moins 26 h). */
export function isBackupStale(lastSuccessAt: Date | null, frequencyHours: number, now = new Date()): boolean {
  if (!lastSuccessAt) return true;
  return now.getTime() - lastSuccessAt.getTime() > Math.max(2 * frequencyHours, 26) * 3600_000;
}

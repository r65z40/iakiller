import { createHmac } from "node:crypto";

/**
 * Limiteur en mémoire (fenêtre glissante). Suffisant pour une instance unique ; en cas de
 * passage à plusieurs instances, remplacer par un stockage partagé (voir ARCHITECTURE.md).
 *
 * Chaque entrée conserve sa propre fenêtre : le nettoyage d'une clé n'efface jamais par
 * erreur une autre clé dont la fenêtre est plus longue. La taille de la table est bornée
 * (éviction des plus anciennes) pour résister à un afflux d'adresses distinctes.
 */
const MAX_KEYS = 50_000;
const buckets = new Map<string, { hits: number[]; windowMs: number }>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const entry = buckets.get(key);
  const hits = (entry?.hits ?? []).filter((t) => now - t < windowMs);
  // Réinsertion en fin de Map pour un ordre d'éviction de type « plus ancien d'abord ».
  buckets.delete(key);
  if (hits.length >= max) {
    buckets.set(key, { hits, windowMs });
    return false;
  }
  hits.push(now);
  buckets.set(key, { hits, windowMs });
  if (buckets.size > MAX_KEYS) {
    // Purge d'abord les entrées dont la fenêtre est entièrement expirée, chacune selon la sienne.
    for (const [k, v] of buckets) {
      if (!v.hits.some((t) => now - t < v.windowMs)) buckets.delete(k);
    }
    // Si cela ne suffit pas, éviction des plus anciennes jusqu'à revenir sous la limite.
    while (buckets.size > MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}

function fingerprintSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET || process.env.APP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET manquant");
  return "dev-only-secret-change-me";
}

/**
 * Empreinte d'adresse IP à sel quotidien, conservée uniquement en mémoire pour limiter les
 * abus. L'adresse IP brute n'est jamais enregistrée en base.
 */
export function ipFingerprint(ip: string | null, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", `${fingerprintSecret()}:${day}`).update(ip ?? "inconnue").digest("hex").slice(0, 32);
}

/**
 * Adresse IP du client. On NE fait confiance qu'au proxy maîtrisé (voir docs/INSTALLATION.md) :
 * - `X-Real-IP`, que nginx règle sur `$remote_addr` (l'adresse réelle du client), est préféré ;
 * - sinon on prend la DERNIÈRE valeur de `X-Forwarded-For`, celle ajoutée par notre proxy de
 *   tête (Caddy la remplace, nginx l'ajoute en dernier avec `$proxy_add_x_forwarded_for`).
 * La première valeur de `X-Forwarded-For` ne doit jamais être utilisée : le client la contrôle.
 */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}

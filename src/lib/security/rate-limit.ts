import { createHmac } from "node:crypto";

/**
 * Limiteur en mémoire (fenêtre glissante). Suffisant pour une instance unique ; en cas de
 * passage à plusieurs instances, remplacer par un stockage partagé (voir ARCHITECTURE.md).
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    buckets.set(key, list);
    return false;
  }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 50_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * Empreinte d'adresse IP à sel quotidien, conservée uniquement en mémoire pour limiter les
 * abus. L'adresse IP brute n'est jamais enregistrée en base.
 */
export function ipFingerprint(ip: string | null, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const secret = process.env.BETTER_AUTH_SECRET || "dev-only-secret-change-me";
  return createHmac("sha256", `${secret}:${day}`).update(ip ?? "inconnue").digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string | null {
  // À adapter selon le proxy de production (voir ARCHITECTURE.md) : ne faire confiance qu'au proxy maîtrisé.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip");
}

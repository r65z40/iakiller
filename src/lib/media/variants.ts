import "server-only";
import { VARIANT_WIDTHS } from "./variant-url";

/**
 * Variantes redimensionnées des images publiques, gardées en mémoire (LRU borné).
 * La clé inclut la clé de stockage, immuable pour un média donné : un recadrage crée
 * un nouveau média, donc aucune variante ne peut devenir obsolète. Le contrôle d'accès
 * reste fait à chaque requête, avant toute lecture du cache.
 */
const MAX_BYTES = 48 * 1024 * 1024;
const cache = new Map<string, Buffer>();
let cachedBytes = 0;

export function parseVariantWidth(value: string | null): number | null {
  const n = Number(value);
  return (VARIANT_WIDTHS as readonly number[]).includes(n) ? n : null;
}

export async function imageVariant(storageKey: string, original: () => Promise<Buffer | null>, width: number): Promise<Buffer | null> {
  const key = `${storageKey}:${width}`;
  const hit = cache.get(key);
  if (hit) {
    // Rafraîchit l'ordre d'insertion (le plus récent en dernier).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const body = await original();
  if (!body) return null;
  const sharp = (await import("sharp")).default;
  const out = await sharp(body).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  cache.set(key, out);
  cachedBytes += out.length;
  for (const [k, v] of cache) {
    if (cachedBytes <= MAX_BYTES) break;
    cache.delete(k);
    cachedBytes -= v.length;
  }
  return out;
}

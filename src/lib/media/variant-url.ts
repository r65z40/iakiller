/** Largeurs des variantes d'images publiques (partagé client et serveur, sans dépendance). */
export const VARIANT_WIDTHS = [160, 320, 640, 960] as const;

/**
 * Attribut `srcset` pour une image publique (/m/{id}). Les aperçus privés de l'éditeur
 * restent en taille d'origine. `maxWidth` évite de proposer une variante plus large
 * que l'original (inutile : le serveur renverrait l'original).
 */
export function publicSrcSet(url: string | undefined, maxWidth?: number | null): string | undefined {
  if (!url || !url.startsWith("/m/")) return undefined;
  const widths = VARIANT_WIDTHS.filter((w) => !maxWidth || w < maxWidth);
  if (!widths.length) return undefined;
  const parts = widths.map((w) => `${url}?w=${w} ${w}w`);
  if (maxWidth) parts.push(`${url} ${maxWidth}w`);
  return parts.join(", ");
}

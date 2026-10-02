/** Identifiant de bloc généré côté navigateur (pas de valeur de sécurité). */
export function blockId(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

import type { CardDocument, FontId } from "@/lib/cards/document";

/** Champs de marque que le propriétaire peut verrouiller pour toutes les cartes. */
export const LOCKABLE_FIELDS = {
  primaryColor: "Couleur principale",
  pageBackground: "Couleur de fond",
  textColor: "Couleur du texte",
  font: "Police",
  logo: "Logo",
  company: "Nom de la société",
} as const;
export type LockableField = keyof typeof LOCKABLE_FIELDS;

export interface BrandValues {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  font: string;
  logoMediaId: string | null;
  companyName: string | null;
  lockedFields: string[];
}

export function isLockable(v: string): v is LockableField {
  return v in LOCKABLE_FIELDS;
}

/**
 * Applique les verrous de marque côté serveur, quelle que soit la valeur envoyée par le
 * navigateur : un collaborateur ne peut pas contourner un verrou par l'API.
 */
export function applyBrandLocks(doc: CardDocument, brand: BrandValues | null | undefined): CardDocument {
  if (!brand) return doc;
  const locked = new Set(brand.lockedFields.filter(isLockable));
  if (locked.size === 0) return doc;
  const next: CardDocument = structuredClone(doc);
  if (locked.has("primaryColor")) next.theme.primaryColor = brand.primaryColor;
  if (locked.has("pageBackground")) next.theme.pageBackground = brand.backgroundColor;
  if (locked.has("textColor")) next.theme.textColor = brand.textColor;
  if (locked.has("font")) next.theme.font = brand.font as FontId;
  if (locked.has("logo")) next.identity.logoMediaId = brand.logoMediaId;
  if (locked.has("company") && brand.companyName) next.identity.company = brand.companyName;
  return next;
}


/** Constantes CRM (pures, utilisables côté client et serveur). */

export const STAGES = [
  { id: "nouveau", label: "Nouveau" },
  { id: "a_contacter", label: "À contacter" },
  { id: "contacte", label: "Contacté" },
  { id: "devis_a_preparer", label: "Devis à préparer" },
  { id: "devis_envoye", label: "Devis envoyé" },
  { id: "a_relancer", label: "À relancer" },
  { id: "gagne", label: "Gagné" },
  { id: "perdu", label: "Perdu" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as string[];
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));

/** Libellé lisible d'une source de prospect (avec sa précision éventuelle). */
export function sourceLabel(source: string, detail?: string | null): string {
  const base =
    source === "qr" ? "QR code" : source === "campaign" ? "Campagne" : source === "manual" ? "Saisie manuelle" : source === "import" ? "Import" : "Lien direct";
  return detail ? `${base} · ${detail}` : base;
}

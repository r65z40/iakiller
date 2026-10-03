import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { platformCan } from "@/lib/permissions";
import { getSettings, saveSection } from "./store";
import { LEGAL_PAGES, settingsSchema, type LegalPageKey, type PlatformSettings, type SettingsSection } from "./schema";
import type { Staff } from "@/lib/services/orders";

/** Mise à jour d'une section, réservée aux administrateurs, validée et journalisée. */
export async function updateSettingsSection<K extends SettingsSection>(staff: Staff, section: K, value: PlatformSettings[K]) {
  if (!platformCan(staff.platformRole, "platform.settings.manage")) throw new DomainError("forbidden", "Réservé aux administrateurs.");
  const shape = settingsSchema.shape[section];
  const parsed = shape.safeParse(value);
  if (!parsed.success) {
    throw new DomainError("invalid", parsed.error.issues.map((i) => `${i.path.join(".") || section} : ${i.message}`).join(" · "));
  }
  const before = (await getSettings(true))[section];
  await saveSection(section, parsed.data as PlatformSettings[K], staff.id);
  await audit({ actorUserId: staff.id, actorType: "staff", action: `settings.${section}`, metadata: { before, after: parsed.data } });
}

/** Points de réglage qui bloquent encore le lancement commercial. */
export function settingsBlockers(s: PlatformSettings): string[] {
  const out: string[] = [];
  if (!s.brand.publicUrl) out.push("Domaine public non renseigné (Réglages > Marque et domaine).");
  else if (!s.brand.publicUrl.startsWith("https://")) out.push("Le domaine public doit être en HTTPS.");
  for (const k of Object.keys(LEGAL_PAGES) as LegalPageKey[]) {
    if (!s.legal[k].validated) out.push(`« ${LEGAL_PAGES[k]} » non validée juridiquement.`);
  }
  if (!s.analytics.validated) out.push("Régime de mesure d'audience non validé juridiquement.");
  if (s.retention.contentAfterEndDays === null || s.retention.leadsDays === null || s.retention.auditDays === null) {
    out.push("Durées de conservation à définir (contenus après fin de droit, prospects, journaux).");
  }
  return out;
}

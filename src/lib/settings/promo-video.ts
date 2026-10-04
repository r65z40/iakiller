import { fileTypeFromBuffer } from "file-type";
import { storage } from "@/lib/media/storage";
import { getSettings } from "@/lib/settings/store";
import { updateSettingsSection } from "@/lib/settings/service";
import { limits, VIDEO_TYPES } from "@/lib/config";
import { newToken } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import type { Staff } from "@/lib/services/orders";

/**
 * Vidéo de présentation de la page d'accueil (réglage plateforme). Stockée comme objet privé,
 * servie par l'application via /video-accueil. Un seul fichier à la fois : l'ancien est supprimé.
 */
export async function setPromoVideo(staff: Staff, file: { buffer: Buffer; mime?: string }): Promise<{ type: string }> {
  if (file.buffer.length > limits.videoMaxBytes) {
    throw new DomainError("invalid", `Vidéo trop lourde (maximum ${Math.round(limits.videoMaxBytes / (1024 * 1024))} Mo).`);
  }
  // Vérifie le type réel (signature du fichier), pas l'extension déclarée.
  const detected = await fileTypeFromBuffer(file.buffer);
  const mime = detected?.mime ?? "";
  const ext = VIDEO_TYPES[mime];
  if (!ext) throw new DomainError("invalid", "Format vidéo non accepté. Utilisez un fichier MP4 ou WebM.");

  const current = await getSettings(true);
  const previousKey = current.brand.promoVideoKey;
  const key = `platform/promo-${newToken(16)}.${ext}`;
  await storage().put(key, file.buffer, mime);
  await updateSettingsSection(staff, "brand", { ...current.brand, promoVideoKey: key, promoVideoType: mime });
  // L'ancien fichier n'est plus référencé : on le supprime (sans bloquer en cas d'échec).
  if (previousKey && previousKey !== key) await storage().delete(previousKey).catch(() => {});
  return { type: mime };
}

export async function clearPromoVideo(staff: Staff): Promise<void> {
  const current = await getSettings(true);
  const key = current.brand.promoVideoKey;
  await updateSettingsSection(staff, "brand", { ...current.brand, promoVideoKey: "", promoVideoType: "" });
  if (key) await storage().delete(key).catch(() => {});
}

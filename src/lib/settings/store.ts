import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { defaultSettings, mergeSettings, settingsSchema, type PlatformSettings, type SettingsSection } from "./schema";

/**
 * Réglages stockés dans platform_setting (clé « platform »).
 * - getSettings() : lecture asynchrone, rafraîchit le cache (durée de vie 15 s).
 * - settingsSync() : lecture synchrone du dernier état connu (préchargé au démarrage par
 *   src/instrumentation.ts et à chaque rendu par le layout racine), sinon valeurs par défaut.
 * Une seule instance : la mise à jour invalide immédiatement le cache local. Avec plusieurs
 * instances, chaque instance se met à jour au plus tard 15 s après.
 */
const KEY = "platform";
const TTL_MS = 15_000;

const g = globalThis as unknown as { __settings?: { value: PlatformSettings; loadedAt: number } };

export function settingsSync(): PlatformSettings {
  return g.__settings?.value ?? defaultSettings();
}

export async function getSettings(force = false): Promise<PlatformSettings> {
  const cached = g.__settings;
  if (!force && cached && Date.now() - cached.loadedAt < TTL_MS) return cached.value;
  try {
    const [row] = await db.select().from(schema.platformSetting).where(eq(schema.platformSetting.key, KEY));
    const value = mergeSettings(row?.value);
    g.__settings = { value, loadedAt: Date.now() };
    return value;
  } catch {
    // Base indisponible (ex. pendant la compilation) : dernier état connu ou valeurs par défaut.
    return settingsSync();
  }
}

export function invalidateSettings() {
  g.__settings = undefined;
}

/** Remplace une section complète après validation ; renvoie les réglages à jour. */
export async function saveSection<K extends SettingsSection>(section: K, value: PlatformSettings[K], updatedById: string | null) {
  const current = await getSettings(true);
  const next = { ...current, [section]: value };
  const parsed = settingsSchema.parse(next);
  await db
    .insert(schema.platformSetting)
    .values({ key: KEY, value: parsed, updatedById, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.platformSetting.key, set: { value: parsed, updatedById, updatedAt: new Date() } });
  g.__settings = { value: parsed, loadedAt: Date.now() };
  return parsed;
}

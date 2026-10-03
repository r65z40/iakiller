/** Précharge les réglages de la plateforme avant de servir la première requête. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getSettings } = await import("@/lib/settings/store");
    await getSettings(true);
  }
}

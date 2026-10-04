import { appUrl } from "@/lib/config";

/**
 * Géocodage d'une adresse/ville en coordonnées, via Nominatim (OpenStreetMap), côté serveur
 * uniquement. Best-effort : renvoie null en cas d'échec réseau ou d'absence de résultat, pour
 * que la saisie reste possible même sans coordonnées. Respecte la politique d'usage (User-Agent).
 */
export async function geocode(address: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const q = address.trim();
  if (q.length < 3) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": `MaCartePro/1.0 (+${appUrl()})`, "Accept-Language": "fr" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, label: String(first.display_name ?? q).slice(0, 200) };
  } catch {
    return null;
  }
}

import { appUrl, envAppUrl } from "@/lib/config";

/** Origines explicitement autorisées : domaine réglé, URL technique, et AUTH_TRUSTED_ORIGINS. */
function allowedOrigins(): string[] {
  const extra = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const out: string[] = [];
  for (const u of [appUrl(), envAppUrl(), ...extra]) {
    try {
      out.push(new URL(u).origin);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Protection CSRF des routes API à cookie de session. La requête est considérée de même
 * origine si :
 *  - l'hôte de l'en-tête Origin correspond à l'hôte réellement servi (vraie même origine,
 *    valable quel que soit le nom d'hôte : localhost, IP de réseau local, domaine…), ou
 *  - l'Origin figure dans la liste explicitement autorisée, ou
 *  - à défaut d'Origin, Sec-Fetch-Site vaut same-origin.
 * Une requête inter-sites (attaquant) a une origine différente de l'hôte servi : elle est refusée.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return false;
    }
    const host = req.headers.get("host");
    if (host && o.host === host) return true;
    return allowedOrigins().includes(o.origin);
  }
  return req.headers.get("sec-fetch-site") === "same-origin";
}

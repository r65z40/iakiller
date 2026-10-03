import { appUrl, envAppUrl } from "@/lib/config";

/**
 * Protection CSRF des routes API à cookie de session : la requête doit provenir de
 * l'origine de l'application (domaine réglé ou URL technique), via l'en-tête Origin ou
 * Sec-Fetch-Site same-origin.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return [appUrl(), envAppUrl()].some((u) => origin === new URL(u).origin);
  return req.headers.get("sec-fetch-site") === "same-origin";
}

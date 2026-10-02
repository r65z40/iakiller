import { appUrl } from "@/lib/config";

/**
 * Protection CSRF des routes API à cookie de session : la requête doit provenir de
 * l'origine de l'application (en-tête Origin, ou Sec-Fetch-Site same-origin).
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return origin === new URL(appUrl()).origin;
  return req.headers.get("sec-fetch-site") === "same-origin";
}

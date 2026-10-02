import type { schema } from "@/lib/db";

type Media = typeof schema.mediaAsset.$inferSelect;

/**
 * En-têtes de diffusion des fichiers : type exact, nosniff, CSP "sandbox" pour empêcher
 * toute exécution dans le contexte de l'application, téléchargement forcé sur demande.
 */
export function mediaResponse(body: Buffer, media: Media, opts: { cache: "public" | "private"; download?: boolean }) {
  const headers = new Headers({
    "Content-Type": media.mimeType,
    "Content-Length": String(body.length),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    // Durée courte : la désactivation d'une carte est effective au plus tard après 5 minutes
    // dans un navigateur ayant déjà chargé le fichier ; aucun cache partagé (CDN) n'est autorisé.
    "Cache-Control": opts.cache === "public" ? "public, max-age=300, must-revalidate, no-transform" : "private, max-age=60",
  });
  if (opts.cache === "public") headers.set("CDN-Cache-Control", "no-store");
  const filename = media.originalName.replace(/[^\w.\- ]+/g, "_");
  if (media.kind === "document" || opts.download) {
    headers.set("Content-Disposition", `${opts.download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
  }
  return new Response(new Uint8Array(body), { status: 200, headers });
}

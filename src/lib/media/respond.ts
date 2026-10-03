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
  if (media.kind === "document" || opts.download) {
    // Nom de téléchargement sûr : l'extension est imposée d'après le type réel du fichier
    // (un PDF reste .pdf, une image son format), et les caractères de contrôle ou de
    // réécriture bidirectionnelle (U+202E…) sont retirés. On évite ainsi les polyglottes
    // (« plaquette.hta ») et les noms trompeurs servis depuis notre domaine.
    const ext = media.mimeType === "application/pdf" ? "pdf" : (media.mimeType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
    const base = media.originalName.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "").trim();
    const safeBase = (base.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "fichier").replace(/\.+$/, "");
    const filename = `${safeBase}.${ext}`;
    headers.set("Content-Disposition", `${opts.download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  }
  return new Response(new Uint8Array(body), { status: 200, headers });
}

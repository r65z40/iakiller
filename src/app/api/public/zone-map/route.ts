import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isCardPubliclyAccessible } from "@/lib/cards/public";
import { parseDocument } from "@/lib/cards/document";
import { storage } from "@/lib/media/storage";
import { renderZoneMap } from "@/lib/geo/staticmap";

const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Carte de la « zone d'intervention » d'une carte publiée, servie en PNG depuis notre domaine.
 * Les coordonnées proviennent du bloc enregistré (jamais de l'URL) : pas de proxy ouvert.
 * Le rendu est mis en cache dans le stockage (une seule récupération de tuiles par secteur).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return notFound();

  const [card] = await db.select().from(schema.card).where(eq(schema.card.publicToken, token));
  if (!card || !card.publishedVersionId || !(await isCardPubliclyAccessible(card))) return notFound();

  const [version] = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.id, card.publishedVersionId));
  const parsed = version ? parseDocument(version.document) : null;
  if (!parsed?.success) return notFound();
  const block = parsed.data.blocks.find((b) => b.type === "map" && !b.hidden);
  if (!block || block.type !== "map" || block.lat === null || block.lon === null) return notFound();

  const color = parsed.data.theme.primaryColor;
  const key = `platform/zonemap/${block.lat.toFixed(4)}_${block.lon.toFixed(4)}_${block.radiusKm}_${color.replace("#", "")}.png`;

  let png = await storage().get(key);
  if (!png) {
    png = await renderZoneMap({ lat: block.lat, lon: block.lon, radiusKm: block.radiusKm, color });
    await storage().put(key, png, "image/png").catch(() => {});
  }

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isCardPubliclyAccessible } from "@/lib/cards/public";
import { cardQr } from "@/lib/cards/qr";

/**
 * QR code public d'une carte (PNG), utilisable dans une signature email : il n'est servi que
 * si la carte est publiée et accessible, et il pointe vers le lien stable /r/{token}.
 */
export async function GET(_req: Request, ctx: RouteContext<"/r/[token]/qr">) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return new Response("Introuvable", { status: 404 });
  const [card] = await db.select().from(schema.card).where(eq(schema.card.publicToken, token));
  if (!card || !(await isCardPubliclyAccessible(card))) return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  const png = (await cardQr(card, "png")) as Buffer;
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

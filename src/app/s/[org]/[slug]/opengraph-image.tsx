import { ImageResponse } from "next/og";
import sharp from "sharp";
import { and, eq, isNull } from "drizzle-orm";
import { resolvePublicSite } from "@/lib/sites/public";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/media/storage";
import { getSettings } from "@/lib/settings/store";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Image d'aperçu de partage d'un mini-site (mêmes contrôles d'accès que la page publique). */
export const alt = "Mini-site";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
const fontsPromise = Promise.all([
  readFile(path.join(fontDir, "inter-latin-400-normal.woff")),
  readFile(path.join(fontDir, "inter-latin-700-normal.woff")),
]).then(([regular, bold]) => [
  { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
]);

async function mediaAsPng(organizationId: string, mediaId: string | null, w: number, h: number, fit: "cover" | "contain" = "cover") {
  if (!mediaId) return null;
  const [m] = await db
    .select()
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.id, mediaId), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  if (!m || m.kind !== "image") return null;
  const buf = await storage().get(m.storageKey);
  if (!buf) return null;
  const png = await sharp(buf).resize(w, h, { fit, background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function Neutral({ brand }: { brand: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF2F8", color: "#14213D", fontSize: 56, fontWeight: 700 }}>
      {brand}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ org: string; slug: string }> }) {
  const { org, slug } = await params;
  const settings = await getSettings();
  const result = await resolvePublicSite(org, slug);
  if (result.kind !== "ok") return new ImageResponse(<Neutral brand={settings.brand.name} />, { ...size, headers: { "Cache-Control": "no-store" } });

  const { document: doc, site } = result;
  const { identity, theme, banner } = doc;
  const [bannerImg, logo] = await Promise.all([
    mediaAsPng(site.organizationId, banner.mediaId, 1200, 630),
    identity.showLogo ? mediaAsPng(site.organizationId, identity.logoMediaId, 220, 220, "contain") : null,
  ]);
  const name = identity.company || [identity.firstName, identity.lastName].filter(Boolean).join(" ") || site.title;

  const fonts = await fontsPromise;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: theme.primaryColor, fontFamily: "Inter" }}>
        {bannerImg && <img src={bannerImg} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", background: bannerImg ? "rgba(255,255,255,0.35)" : "transparent" }} />
        <div style={{ position: "absolute", left: 60, right: 60, top: 70, bottom: 70, display: "flex", alignItems: "center", gap: 48, padding: "48px 56px", background: "#FFFFFF", borderRadius: 36, boxShadow: "0 20px 60px rgba(20,33,61,0.25)" }}>
          {logo && <img src={logo} alt="" width={200} height={200} style={{ borderRadius: 28, objectFit: "contain", flexShrink: 0 }} />}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 66, fontWeight: 700, color: theme.textColor, lineHeight: 1.1 }}>{name}</div>
            {identity.jobTitle && <div style={{ fontSize: 36, color: theme.mutedColor, marginTop: 16 }}>{identity.jobTitle}</div>}
            <div style={{ display: "flex", marginTop: 36, fontSize: 26, color: theme.mutedColor }}>Site vitrine · {settings.brand.name}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts, headers: { "Cache-Control": "public, max-age=300" } },
  );
}

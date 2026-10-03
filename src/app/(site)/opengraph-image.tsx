import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brand } from "@/lib/config";
import { getSettings } from "@/lib/settings/store";

/**
 * Image d'aperçu du site, affichée lors des partages (WhatsApp, LinkedIn, SMS, X…).
 * Générée aux couleurs de la marque, sans dépendre d'un fichier image à maintenir.
 */
export const alt = "Cartes de visite numériques";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
const fonts = Promise.all([
  readFile(path.join(fontDir, "inter-latin-400-normal.woff")),
  readFile(path.join(fontDir, "inter-latin-700-normal.woff")),
]).then(([regular, bold]) => [
  { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
]);

export default async function Image() {
  await getSettings();
  const name = brand.name;
  const tagline = brand.tagline;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "90px", background: "linear-gradient(135deg, #0047BB 0%, #003A99 100%)", color: "#FFFFFF", fontFamily: "Inter" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FFFFFF", color: "#0047BB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{name}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>
          La carte de visite numérique des pros.
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "rgba(255,255,255,0.88)", maxWidth: 950 }}>{`${tagline}.`}</div>
        <div style={{ marginTop: 56, display: "flex", gap: 16, fontSize: 26, color: "rgba(255,255,255,0.95)" }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "12px 24px" }}>QR code permanent</div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "12px 24px" }}>vCard en un geste</div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "12px 24px" }}>Essai 7 jours</div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts },
  );
}

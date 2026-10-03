import type { Metadata, Viewport } from "next";
import { brand, appUrl } from "@/lib/config";
import { getSettings } from "@/lib/settings/store";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  await getSettings();
  return {
    metadataBase: new URL(appUrl()),
    title: { default: `${brand.name} – ${brand.tagline}`, template: `%s – ${brand.name}` },
    description: "Créez et partagez des cartes de visite numériques professionnelles, avec QR code, statistiques et formulaire de contact.",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0047BB",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Rafraîchit le cache des réglages (marque, domaine, société…) pour ce rendu.
  await getSettings();
  return (
    <html lang="fr">
      <body className="min-h-dvh font-sans antialiased">
        <a href="#contenu" className="sr-only-focusable fixed left-2 top-2 z-50 rounded bg-white px-3 py-2 font-semibold shadow">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}

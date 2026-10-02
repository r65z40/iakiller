import type { Metadata, Viewport } from "next";
import { brand, appUrl } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${brand.name} – ${brand.tagline}`, template: `%s – ${brand.name}` },
  description: "Créez et partagez des cartes de visite numériques professionnelles, avec QR code, statistiques et formulaire de contact.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0047BB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

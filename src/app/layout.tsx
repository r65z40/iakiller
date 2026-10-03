import type { Metadata, Viewport } from "next";
import { brand, appUrl } from "@/lib/config";
import { getSettings } from "@/lib/settings/store";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  await getSettings();
  const description = "Créez et partagez une carte de visite numérique professionnelle : QR code permanent, fiche contact vCard, formulaire de demandes et statistiques. Essai gratuit 7 jours, sans carte bancaire.";
  return {
    metadataBase: new URL(appUrl()),
    title: { default: `${brand.name} – ${brand.tagline}`, template: `%s – ${brand.name}` },
    description,
    applicationName: brand.name,
    keywords: ["carte de visite numérique", "carte de visite digitale", "QR code carte de visite", "vCard", "carte de visite virtuelle", "carte de visite connectée", "artisan", "indépendant", "PME"],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: brand.name,
      locale: "fr_FR",
      url: appUrl(),
      title: `${brand.name} – ${brand.tagline}`,
      description,
    },
    twitter: { card: "summary_large_image", title: `${brand.name} – ${brand.tagline}`, description },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    formatDetection: { telephone: false },
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

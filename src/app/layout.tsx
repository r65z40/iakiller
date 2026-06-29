import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IAKiller — Rendez votre contenu IA indétectable",
  description:
    "Supprimez les traces IA de vos images, textes et vidéos. Nettoyage des métadonnées, modification subtile du contenu. Gratuit et instantané.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

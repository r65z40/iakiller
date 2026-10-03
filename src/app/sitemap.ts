import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

/**
 * Plan du site : uniquement les pages commerciales (aucun annuaire des cartes n'est publié).
 * Priorités et fréquences indicatives pour les moteurs de recherche.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/fonctionnement", priority: 0.8, freq: "monthly" },
    { path: "/modeles", priority: 0.8, freq: "monthly" },
    { path: "/tarifs", priority: 0.9, freq: "weekly" },
    { path: "/entreprise", priority: 0.7, freq: "monthly" },
    { path: "/creation-accompagnee", priority: 0.7, freq: "monthly" },
    { path: "/faq", priority: 0.6, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "yearly" },
  ];
  return pages.map((p) => ({ url: `${base}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}

import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

/** Uniquement les pages commerciales : aucun annuaire des cartes n'est publié. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/fonctionnement", "/modeles", "/tarifs", "/entreprise", "/creation-accompagnee", "/faq", "/contact"].map((p) => ({ url: `${appUrl()}${p}` }));
}

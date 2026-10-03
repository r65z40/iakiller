import type { Metadata } from "next";
import { appUrl, brand } from "@/lib/config";

/**
 * Fabrique de métadonnées pour les pages commerciales : titre, description, URL canonique,
 * Open Graph et Twitter Card cohérents. Le titre passe par le gabarit « %s – Marque » défini
 * dans le layout racine. L'image d'aperçu est générée par (site)/opengraph-image.tsx.
 */
export function pageMeta(opts: { title?: string; description: string; path?: string; keywords?: string[] }): Metadata {
  const url = `${appUrl()}${opts.path ?? ""}`;
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: opts.path ?? "/" },
    openGraph: {
      type: "website",
      siteName: brand.name,
      locale: "fr_FR",
      url,
      title: opts.title ? `${opts.title} – ${brand.name}` : `${brand.name} – ${brand.tagline}`,
      description: opts.description,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title ? `${opts.title} – ${brand.name}` : `${brand.name} – ${brand.tagline}`,
      description: opts.description,
    },
  };
}

/** Composant d'injection de données structurées JSON-LD (schema.org). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: appUrl(),
    description: brand.tagline,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: appUrl(),
    inLanguage: "fr-FR",
  };
}

/** SoftwareApplication (SaaS) : aide les moteurs à comprendre le produit. */
export function softwareLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `${brand.name} : ${brand.tagline}.`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Essai gratuit de 7 jours, sans carte bancaire." },
  };
}

export function faqLd(qa: readonly (readonly [string, string])[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${appUrl()}${it.path}` })),
  };
}

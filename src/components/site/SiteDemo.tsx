"use client";

import { useState } from "react";
import { CardView } from "@/components/card/CardView";
import { DEMO_MEDIA } from "@/lib/cards/demo";
import { DEMO_SITE } from "@/lib/sites/demo";
import { pageDocument } from "@/lib/sites/document";

/** Aperçu interactif d'un mini-site (mêmes composants que le rendu public), sans mesure ni envoi. */
export function SiteDemo() {
  const [slug, setSlug] = useState(DEMO_SITE.pages[0].slug);
  const page = DEMO_SITE.pages.find((p) => p.slug === slug) ?? DEMO_SITE.pages[0];
  return (
    <div className="overflow-hidden rounded-3xl ring-1 ring-line shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-line bg-white px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
        <span className="ml-3 truncate rounded-md bg-surface px-3 py-1 text-xs text-muted">macarte.pro/s/atelier-moreau/{page.slug === DEMO_SITE.pages[0].slug ? "" : page.slug}</span>
      </div>
      <nav aria-label="Pages du mini-site de démonstration" className="flex flex-wrap gap-1 border-b border-line bg-white px-3 py-2">
        {DEMO_SITE.pages.map((p) => (
          <button key={p.id} type="button" onClick={() => setSlug(p.slug)} aria-current={p.slug === slug ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${p.slug === slug ? "bg-ink text-white" : "text-ink hover:bg-surface"}`}>
            {p.label}
          </button>
        ))}
      </nav>
      <div style={{ background: DEMO_SITE.theme.pageBackground }} className="max-h-[560px] overflow-y-auto">
        <CardView doc={pageDocument(DEMO_SITE, page)} media={DEMO_MEDIA} mode="preview" layout="site" />
      </div>
    </div>
  );
}

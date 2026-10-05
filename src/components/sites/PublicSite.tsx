import Link from "next/link";
import { CardView } from "@/components/card/CardView";
import { buildMediaMap } from "@/lib/cards/media-map";
import { collectMediaIds } from "@/lib/cards/document";
import { brand } from "@/lib/config";
import { leadFormToken } from "@/lib/security/signed";
import { pageDocument, type SiteDocument } from "@/lib/sites/document";

/** Rendu public d'une page de mini-site : barre de navigation entre pages + rendu de blocs réutilisé. */
export async function PublicSite({
  organizationId,
  orgSlug,
  site,
  document,
  activeSlug,
}: {
  organizationId: string;
  orgSlug: string;
  site: { id: string; slug: string; publicToken: string; title: string };
  document: SiteDocument;
  activeSlug: string | null;
}) {
  const page = (activeSlug && document.pages.find((p) => p.slug === activeSlug)) || document.pages[0];
  const doc = pageDocument(document, page);
  const media = await buildMediaMap(organizationId, collectMediaIds(doc), "public");
  const hasLeadForm = page.blocks.some((b) => b.type === "leadForm" && !b.hidden);
  const base = `/s/${orgSlug}/${site.slug}`;
  const siteName = document.identity.company || [document.identity.firstName, document.identity.lastName].filter(Boolean).join(" ") || site.title;

  return (
    <div className="min-h-dvh bg-[#E9EDF5]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2" aria-label="Pages du site">
          <Link href={base} className="font-extrabold tracking-tight text-[#14213D]">{siteName}</Link>
          <ul className="flex flex-wrap gap-1">
            {document.pages.map((p, i) => {
              const href = i === 0 ? base : `${base}/${p.slug}`;
              const active = p.slug === page.slug;
              return (
                <li key={p.id}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm font-semibold ${active ? "bg-[#0047BB] text-white" : "text-[#14213D] hover:bg-[#E9EDF5]"}`}>
                    {p.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-[520px] px-0 py-0">
        <CardView
          doc={doc}
          media={media}
          mode="public"
          publicToken={site.publicToken}
          leadEndpoint="site"
          leadFormToken={hasLeadForm ? leadFormToken(site.id) : undefined}
          footer={{ brandName: brand.name, privacyUrl: "/confidentialite#visiteurs", legalUrl: "/mentions-legales" }}
        />
      </main>
    </div>
  );
}

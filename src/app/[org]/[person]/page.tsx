import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolvePublicCard } from "@/lib/cards/public";
import { collectMediaIds } from "@/lib/cards/document";
import { buildMediaMap } from "@/lib/cards/media-map";
import { CardView } from "@/components/card/CardView";
import { analyticsConfig, sanitizeUtm } from "@/lib/analytics/config";
import { leadFormToken } from "@/lib/security/signed";
import { brand } from "@/lib/config";

export const dynamic = "force-dynamic";

type Props = PageProps<"/[org]/[person]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org, person } = await params;
  const result = await resolvePublicCard(org, person);
  if (result.kind !== "ok") return { title: "Carte indisponible", robots: { index: false, follow: false } };
  const { identity } = result.document;
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.company;
  // Métadonnées limitées aux informations explicitement publiées sur la carte.
  return {
    title: { absolute: [name, identity.company && name !== identity.company ? identity.company : null].filter(Boolean).join(" – ") },
    description: [identity.jobTitle, identity.company].filter(Boolean).join(" · ") || undefined,
    robots: result.organization.allowIndexing ? { index: true, follow: false } : { index: false, follow: false },
  };
}

export default async function PublicCardPage({ params, searchParams }: Props) {
  const { org, person } = await params;
  const sp = await searchParams;
  const result = await resolvePublicCard(org, person);
  if (result.kind === "redirect") redirect(result.path);
  if (result.kind !== "ok") notFound();

  const { document: doc, card } = result;
  const media = await buildMediaMap(card.organizationId, collectMediaIds(doc), "public");
  const cfg = analyticsConfig();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const utm = {
    source: sanitizeUtm(one(sp.utm_source)),
    medium: sanitizeUtm(one(sp.utm_medium)),
    campaign: sanitizeUtm(one(sp.utm_campaign)),
  };
  const source = one(sp.src) === "qr" ? "qr" : utm.campaign || utm.source ? "campaign" : "direct";
  const hasLeadForm = doc.blocks.some((b) => b.type === "leadForm" && !b.hidden);

  return (
    <main id="contenu" className="min-h-dvh px-3 py-4 sm:py-10" style={{ background: doc.theme.pageBackground }}>
      <CardView
        doc={doc}
        media={media}
        mode="public"
        publicToken={card.publicToken}
        vcardUrl={`/${org}/${person}/vcard`}
        analytics={{ enabled: cfg.enabled, requireConsent: cfg.requireConsent, source, utm: Object.fromEntries(Object.entries(utm).filter(([, v]) => v)) as Record<string, string> }}
        leadFormToken={hasLeadForm ? leadFormToken(card.id) : undefined}
        footer={{ brandName: brand.name, privacyUrl: "/confidentialite#visiteurs", legalUrl: "/mentions-legales" }}
      />
    </main>
  );
}

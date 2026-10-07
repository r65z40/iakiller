import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicSiteForRequest } from "@/lib/sites/public";
import { PublicSite } from "@/components/sites/PublicSite";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/s/[org]/[slug]">): Promise<Metadata> {
  const { org, slug } = await params;
  const r = await resolvePublicSiteForRequest(org, slug);
  if (r.kind !== "ok") return { title: "Site indisponible", robots: { index: false, follow: false } };
  const name = r.document.identity.company || r.site.title;
  const description = r.document.identity.jobTitle || undefined;
  return {
    title: name,
    description,
    robots: r.organization.allowIndexing ? undefined : { index: false, follow: false },
    openGraph: { type: "website", title: name, description },
  };
}

export default async function SiteHomePage({ params }: PageProps<"/s/[org]/[slug]">) {
  const { org, slug } = await params;
  const r = await resolvePublicSiteForRequest(org, slug);
  if (r.kind === "not_found") notFound();
  if (r.kind !== "ok") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-8 text-center">
        <h1 className="text-xl font-bold">Site indisponible</h1>
        <p className="mt-2 text-sm text-muted">Ce mini-site n&apos;est pas accessible pour le moment.</p>
      </main>
    );
  }
  return <PublicSite organizationId={r.organization.id} orgSlug={org} site={{ id: r.site.id, slug: r.site.slug, publicToken: r.site.publicToken, title: r.site.title }} document={r.document} activeSlug={null} />;
}

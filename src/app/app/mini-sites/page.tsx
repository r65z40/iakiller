import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listSitesForActor } from "@/lib/sites/service";
import { appUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { CreateSite, SiteActions } from "./SitesClient";

export default async function MiniSitesPage() {
  const ctx = await requireOrgPage("cards.create");
  const sites = await listSitesForActor(ctx);
  const base = `${appUrl()}/s/${ctx.organization.slug}`;
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Mini-sites"
        description="Un vrai site vitrine multi-pages (Accueil, Services, Réalisations, Contact), construit avec les mêmes blocs que vos cartes. Aucune double saisie : thème, identité et bannière sont partagés par toutes les pages."
        actions={<CreateSite />}
      />
      {sites.length === 0 ? (
        <EmptyState title="Aucun mini-site">Créez votre premier mini-site à partir d&apos;un modèle métier ou d&apos;une page vierge.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {sites.map((s) => {
            const pages = Array.isArray((s.draft as { pages?: unknown[] })?.pages) ? (s.draft as { pages: unknown[] }).pages.length : 0;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-line">
                <div>
                  <p className="font-bold">
                    {s.title}{" "}
                    {s.status === "published"
                      ? <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">En ligne</span>
                      : <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line">Brouillon</span>}
                  </p>
                  <p className="text-xs text-muted">{pages} page(s) · modifié le {formatDateTime(s.updatedAt)}{s.status === "published" ? ` · ${base}/${s.slug}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === "published" && <a href={`${base}/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand underline">Voir</a>}
                  <Link href={`/app/mini-sites/${s.id}`} className="text-sm font-semibold text-brand underline">Modifier</Link>
                  <SiteActions siteId={s.id} title={s.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

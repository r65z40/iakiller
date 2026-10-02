import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getOrgContext, listMemberships } from "@/lib/context";
import { can } from "@/lib/permissions";
import { brand } from "@/lib/config";
import { AppNav, type NavItem } from "./_components/AppNav";
import { EntitlementBanner } from "./_components/EntitlementBanner";
import { switchOrganizationAction } from "./_actions/org";
import { SignOutButton } from "./_components/SignOutButton";

export const metadata: Metadata = { title: "Espace client", robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const ctx = await getOrgContext();
  const memberships = await listMemberships(user.id);

  const items: NavItem[] = ctx
    ? [
        { href: "/app", label: "Tableau de bord" },
        { href: "/app/cartes", label: "Cartes" },
        { href: "/app/medias", label: "Médias" },
        ...(can(ctx, "brand.update") ? [{ href: "/app/marque", label: "Identité d'entreprise" }] : []),
        ...(can(ctx, "members.view") ? [{ href: "/app/membres", label: "Membres" }] : []),
        { href: "/app/statistiques", label: "Statistiques" },
        { href: "/app/prospects", label: "Prospects" },
        ...(can(ctx, "billing.view") ? [{ href: "/app/abonnement", label: "Abonnement et factures" }] : []),
        ...(can(ctx, "service.order") ? [{ href: "/app/prestations", label: "Création accompagnée" }] : []),
        { href: "/app/assistance", label: "Assistance" },
        { href: "/app/parametres", label: "Paramètres" },
      ]
    : [{ href: "/app/organisations/nouvelle", label: "Créer une organisation" }];

  const sidebar = (
    <div className="flex h-full flex-col gap-5">
      <Link href="/app" className="px-3 text-lg font-extrabold text-brand">{brand.name}</Link>
      {ctx && (
        <form action={switchOrganizationAction} className="px-1">
          <label htmlFor="org-switch" className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Organisation</label>
          <div className="mt-1 flex gap-1">
            <select id="org-switch" name="organizationId" defaultValue={ctx.organization.id} className="min-h-10 w-full rounded-lg border border-line bg-white px-2 text-sm">
              {memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>{m.organization.name}</option>
              ))}
              {ctx.supportGrantId && <option value={ctx.organization.id}>{ctx.organization.name} (assistance)</option>}
            </select>
            <button type="submit" className="rounded-lg px-2 text-sm font-semibold text-brand ring-1 ring-line">OK</button>
          </div>
          <Link href="/app/organisations/nouvelle" className="mt-1 block px-2 text-xs text-brand underline">+ Nouvelle organisation</Link>
        </form>
      )}
      <AppNav items={items} />
      <div className="mt-auto space-y-2 border-t border-line px-3 pt-4 text-sm">
        <p className="truncate font-semibold" title={user.email}>{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
        {(user.platformRole === "admin" || user.platformRole === "support") && <Link href="/admin" className="block text-brand underline">Administration</Link>}
        <SignOutButton />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      {ctx?.supportGrantId && (
        <div role="alert" className="bg-[#14213d] px-4 py-2 text-center text-sm font-semibold text-white">
          Mode assistance : vous intervenez dans « {ctx.organization.name} ». Toutes vos actions sont journalisées.
        </div>
      )}
      {ctx && <EntitlementBanner ent={ctx.entitlement} canBill={can(ctx, "billing.view")} />}
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-line bg-white px-3 py-5 lg:block">{sidebar}</aside>
        <div className="min-w-0 flex-1">
          <details className="border-b border-line bg-white lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 font-bold">
              <span className="text-brand">{brand.name}</span>
              <span className="text-sm text-muted">Menu</span>
            </summary>
            <div className="px-3 pb-4">{sidebar}</div>
          </details>
          <main id="contenu" className="px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

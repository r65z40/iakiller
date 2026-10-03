import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/context";
import { platformCan } from "@/lib/permissions";
import { brand } from "@/lib/config";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

const NAV = [
  ["/admin", "Tableau de bord"],
  ["/admin/organisations", "Organisations"],
  ["/admin/utilisateurs", "Utilisateurs"],
  ["/admin/reglages", "Réglages"],
  ["/admin/plans", "Plans et prestations"],
  ["/admin/prestations", "Commandes de création"],
  ["/admin/support", "Support"],
  ["/admin/facturation", "Facturation"],
  ["/admin/audit", "Journal d'audit"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!platformCan(user.platformRole, "platform.view")) redirect("/app");
  return (
    <div className="min-h-dvh bg-surface">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-extrabold">{brand.name} · Administration <span className="ml-2 rounded bg-white/15 px-2 py-0.5 text-xs">{user.platformRole}</span></p>
          <nav aria-label="Administration" className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="rounded px-2 py-1 hover:bg-white/10">{label}</Link>)}
            <Link href="/app" className="rounded px-2 py-1 text-white/70 hover:bg-white/10">Espace client</Link>
          </nav>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

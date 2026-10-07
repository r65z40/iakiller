import Link from "next/link";
import { brand, promoBanner } from "@/lib/config";
import { PromoBanner } from "@/components/site/PromoBanner";

const NAV = [
  ["/fonctionnement", "Fonctionnement"],
  ["/modeles", "Modèles"],
  ["/mini-sites", "Mini-sites"],
  ["/tarifs", "Tarifs"],
  ["/entreprise", "Entreprises"],
  ["/creation-accompagnee", "Création accompagnée"],
  ["/faq", "FAQ"],
] as const;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const promo = promoBanner();
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {promo && <PromoBanner banner={promo} />}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="text-xl font-extrabold text-brand">{brand.name}</Link>
          <nav aria-label="Navigation principale" className="order-3 flex w-full flex-wrap gap-x-4 gap-y-1 text-sm font-medium md:order-none md:w-auto">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="py-1 hover:text-brand">{label}</Link>)}
          </nav>
          <div className="flex gap-2">
            <Link href="/connexion" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface">Connexion</Link>
            <Link href="/inscription" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Essai gratuit</Link>
          </div>
        </div>
      </header>
      <main id="contenu" className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
          <div>
            <p className="font-extrabold text-brand">{brand.name}</p>
            <p className="mt-2 text-muted">{brand.tagline}.</p>
          </div>
          <ul className="space-y-1">
            <li><Link href="/contact" className="hover:underline">Contact</Link></li>
            <li><Link href="/faq" className="hover:underline">Questions fréquentes</Link></li>
            <li><Link href="/creation-accompagnee" className="hover:underline">Création accompagnée</Link></li>
          </ul>
          <ul className="space-y-1">
            <li><Link href="/mentions-legales" className="hover:underline">Mentions légales</Link></li>
            <li><Link href="/conditions" className="hover:underline">Conditions du service</Link></li>
            <li><Link href="/confidentialite" className="hover:underline">Confidentialité</Link></li>
            <li><Link href="/cookies" className="hover:underline">Cookies et mesure d&apos;audience</Link></li>
            <li><Link href="/sous-traitance" className="hover:underline">Accord de sous-traitance (DPA)</Link></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

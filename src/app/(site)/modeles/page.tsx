import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { DEMO_CARDS } from "@/lib/cards/demo";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { DemoCard } from "@/components/site/DemoCard";

export function generateMetadata(): Metadata {
  return pageMeta({ title: 'Modèles de carte de visite numérique', description: 'Trois modèles — Classique, Portrait, Entreprise — pour présenter le même contenu. Démonstrations interactives et personnalisables : couleurs, police, logo et arrondis.', path: '/modeles' });
}

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Trois modèles, un même contenu</h1>
      <p className="mt-2 max-w-2xl text-muted">Les modèles changent la présentation, jamais vos données : vous pouvez passer de l&apos;un à l&apos;autre à tout moment. Couleurs, police, arrondis et boutons se personnalisent. Ces démonstrations sont interactives et entièrement fictives.</p>
      <ul className="mt-10 grid gap-8 lg:grid-cols-3">
        {DEMO_CARDS.map((d) => (
          <li key={d.id}>
            <h2 className="text-lg font-bold">{d.template}</h2>
            <p className="mb-3 text-sm text-muted">{TEMPLATE_PRESETS[d.id as keyof typeof TEMPLATE_PRESETS]?.description}</p>
            <DemoCard id={d.id} />
          </li>
        ))}
      </ul>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-gradient-to-br from-brand-soft to-white p-8 ring-1 ring-brand/15">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-sm font-bold text-white">Pro</span>
          <h2 className="mt-3 text-2xl font-extrabold">Besoin de plus qu&apos;une carte ? Un mini-site vitrine.</h2>
          <p className="mt-2 max-w-2xl text-muted">À partir du Pro, créez un vrai site multi-pages (Accueil, Services, Réalisations, Contact) avec des modèles par métier — artisan, beauté, restaurant, profession libérale — et les mêmes blocs que vos cartes.</p>
        </div>
        <Link href="/fonctionnement" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">Découvrir le mini-site</Link>
      </div>
    </div>
  );
}

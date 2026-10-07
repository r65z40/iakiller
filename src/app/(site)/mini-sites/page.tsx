import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, LayoutTemplate, KanbanSquare, Send, QrCode } from "lucide-react";
import { pageMeta } from "@/lib/seo";
import { SITE_TEMPLATES } from "@/lib/sites/defaults";
import { SiteDemo } from "@/components/site/SiteDemo";

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Mini-site vitrine",
    description: "Créez un vrai site vitrine multi-pages (Accueil, Services, Réalisations, Contact) avec les mêmes blocs que vos cartes, en glisser-déposer, à partir d'un modèle métier. Inclus à partir de la formule Pro.",
    path: "/mini-sites",
  });
}

const POINTS = [
  { icon: LayoutTemplate, title: "Multi-pages, en glisser-déposer", text: "Accueil, Services, Réalisations, Contact — ou vos propres pages. Les mêmes blocs que vos cartes : galerie, avant/après, horaires, zone d'intervention, formulaire…" },
  { icon: Check, title: "Zéro double saisie", text: "Thème, logo et coordonnées sont partagés par toutes les pages. Vous pouvez même créer le mini-site à partir d'une carte existante." },
  { icon: KanbanSquare, title: "Relié à votre CRM", text: "Le formulaire du mini-site alimente directement votre pipeline de prospects, comme vos cartes." },
  { icon: QrCode, title: "QR & adresse dédiés", text: "Une adresse publique propre et un QR intelligent qui peut pointer vers le mini-site." },
  { icon: Send, title: "Relances automatiques", text: "Chaque demande peut déclencher une relance email ou une tâche de rappel, au bon moment." },
  { icon: Check, title: "Sans agence, sans code", text: "Partez d'un modèle métier et publiez en quelques minutes. Modifiable à tout moment." },
];

export default function MiniSitesPage() {
  return (
    <>
      {/* Héros */}
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-sm font-bold text-white">Inclus à partir du Pro</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Un vrai site vitrine, construit comme vos cartes</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">Plus qu&apos;une carte : un mini-site multi-pages pour présenter votre activité, vos réalisations et capter des demandes — sans agence et sans code.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/inscription" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark">Essayer gratuitement <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/tarifs" className="rounded-xl bg-white px-6 py-3.5 font-semibold ring-1 ring-line transition hover:bg-surface">Voir les tarifs</Link>
          </div>
        </div>
      </section>

      {/* Démo interactive */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-3xl font-extrabold">Aperçu interactif</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Cliquez sur les pages : c&apos;est le rendu réel d&apos;un mini-site publié (exemple fictif).</p>
        <div className="mt-8"><SiteDemo /></div>
      </section>

      {/* Atouts */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-3xl font-extrabold">Pourquoi un mini-site</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {POINTS.map((p) => (
              <li key={p.title} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand"><p.icon className="h-5 w-5" /></div>
                <h3 className="mt-4 font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Modèles métiers */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-extrabold">Des modèles prêts pour votre métier</h2>
        <p className="mt-2 max-w-2xl text-muted">Partez d&apos;un modèle et personnalisez-le. Vous gardez la main sur chaque page et chaque bloc.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_TEMPLATES.filter((t) => t.id !== "vierge").map((t) => (
            <li key={t.id} className="rounded-2xl bg-white p-6 ring-1 ring-line">
              <h3 className="font-bold">{t.label}</h3>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14 text-white">
          <div>
            <h2 className="text-3xl font-extrabold">Lancez votre mini-site aujourd&apos;hui</h2>
            <p className="mt-2 max-w-xl text-white/85">Essai gratuit 7 jours, tout débloqué, sans carte bancaire.</p>
          </div>
          <Link href="/inscription" className="rounded-lg bg-white px-5 py-3 font-semibold text-brand transition hover:bg-brand-soft">Commencer l&apos;essai</Link>
        </div>
      </section>
    </>
  );
}

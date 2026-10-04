import Link from "next/link";
import type { Metadata } from "next";
import { QrCode, IdCard, Inbox, BarChart3, Users, RefreshCw, Smartphone, Check, Sparkles, ArrowRight, Mail, CalendarClock, ShieldCheck, Car } from "lucide-react";
import { brand } from "@/lib/config";
import { listPlans } from "@/lib/billing/service";
import { DemoCard } from "@/components/site/DemoCard";
import { DEMO_CARDS } from "@/lib/cards/demo";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { JsonLd, organizationLd, websiteLd, softwareLd, pageMeta } from "@/lib/seo";
import { HOME_FAQ } from "@/lib/content/faq";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return pageMeta({
    description:
      "La carte de visite numérique des artisans, indépendants et PME : éditeur simple, QR code permanent, fiche contact vCard, formulaire de demandes et statistiques claires. Essai gratuit 7 jours, sans carte bancaire.",
    path: "/",
  });
}

const STEPS = [
  { icon: IdCard, title: "Créez votre carte", text: "Un éditeur par blocs, en quelques minutes. Vos coordonnées, vos liens, vos photos, vos horaires — glissés-déposés, aperçu en direct." },
  { icon: QrCode, title: "Partagez-la partout", text: "Un lien court et un QR code à imprimer sur vos supports. Le visiteur vous appelle ou enregistre votre contact en un geste." },
  { icon: Inbox, title: "Recevez des demandes", text: "Un formulaire intégré : les demandes arrivent dans votre espace, avec des statistiques honnêtes et expliquées." },
];

const FEATURES = [
  { icon: RefreshCw, title: "Toujours à jour", text: "Changement de numéro ou de poste : vous modifiez la carte, le QR code déjà imprimé reste valable." },
  { icon: IdCard, title: "Fiche contact (vCard)", text: "« Ajouter aux contacts » enregistre nom, téléphones, email et adresse d'un seul geste." },
  { icon: Smartphone, title: "Pensée pour le mobile", text: "Grands boutons d'appel, lisible au soleil, rapide même en 4G faible. Compatible Apple et Google Wallet." },
  { icon: Inbox, title: "Formulaire sur mesure", text: "Composez votre propre formulaire : vos questions, demande de rendez-vous, champs obligatoires. Les demandes arrivent dans votre espace et par email." },
  { icon: BarChart3, title: "Statistiques expliquées", text: "Ouvertures, clics, appareils et origines (dont vos QR par support) — avec la définition de chaque chiffre. Aucun chiffre trompeur." },
  { icon: Mail, title: "Signature email assortie", text: "Générez une signature d'email aux couleurs de votre carte, à coller dans Gmail, Outlook ou Apple Mail." },
  { icon: Users, title: "Pour toute l'équipe", text: "Charte graphique commune, champs verrouillés, import CSV des salariés, désactivation immédiate d'un départ." },
];

const PERSONAS = [
  { title: "Artisans & indépendants", text: "Une carte pro, un QR code sur le devis et le véhicule, vos avis et votre galerie de réalisations." },
  { title: "Commerciaux & freelances", text: "Partagez par SMS ou en rendez-vous, mesurez ce qui marche, capturez les demandes entrantes." },
  { title: "TPE & PME", text: "Équipez toute l'équipe d'un coup, gardez une charte cohérente, gérez les arrivées et les départs." },
];

const COMPARISON: [string, boolean, string][] = [
  ["Se met à jour sans réimprimer", true, "Carte papier : à refaire à chaque changement"],
  ["Enregistrement du contact en 1 clic", true, "Papier : ressaisie manuelle"],
  ["Appel, email, itinéraire, WhatsApp", true, "Papier : lecture seule"],
  ["Vous savez ce qui est consulté", true, "Papier : aucune mesure"],
  ["Zéro impression, zéro perte", true, "Papier : stock à gérer, cartes perdues"],
];

export default async function Home() {
  const plans = await listPlans().catch(() => []);
  const entry = plans[0]?.monthly ?? null;
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd(), softwareLd()]} />

      {/* Héros */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-soft via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand ring-1 ring-brand/20">
              <Sparkles className="h-4 w-4" /> Essai gratuit 7 jours, sans carte bancaire
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              La carte de visite <span className="text-brand">numérique</span> des artisans, indépendants et PME.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Créez votre carte en quelques minutes, partagez-la par QR code ou par lien, et recevez des demandes de contact. Ou confiez sa création à notre équipe.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark">
                Créer ma carte gratuitement <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/modeles" className="rounded-lg bg-white px-5 py-3 font-semibold ring-1 ring-line transition hover:bg-surface">Voir des exemples</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Sans carte bancaire</li>
              <li className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Sans cookie de suivi par défaut</li>
              <li className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> QR code permanent</li>
              <li className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Conçue pour le RGPD</li>
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 -z-10 translate-x-6 translate-y-6 rounded-[2rem] bg-brand/10" aria-hidden />
            <DemoCard id="classique" />
            <p className="mt-3 text-center text-xs text-muted">Exemple interactif et fictif réalisé avec {brand.name}.</p>
          </div>
        </div>
      </section>

      {/* 3 étapes */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold">Votre carte en ligne en trois étapes</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Pas besoin d&apos;être à l&apos;aise avec l&apos;informatique : tout se fait depuis votre téléphone ou votre ordinateur.</p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl bg-surface p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><s.icon className="h-6 w-6" /></div>
              <p className="mt-4 text-sm font-semibold text-brand">Étape {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Fonctions */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-extrabold">Tout ce qu&apos;une carte papier ne sait pas faire</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl bg-white p-6 ring-1 ring-line transition hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand"><f.icon className="h-5 w-5" /></div>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Modèles */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold">Un design soigné, un modèle pour chaque style</h2>
            <p className="mt-2 max-w-2xl text-muted">Trois présentations du même contenu : changez à tout moment, personnalisez les couleurs, la police et le logo.</p>
          </div>
          <Link href="/modeles" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Explorer les modèles <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <ul className="mt-10 grid gap-8 lg:grid-cols-3">
          {DEMO_CARDS.map((d) => (
            <li key={d.id}>
              <h3 className="text-lg font-bold">{d.template}</h3>
              <p className="mb-3 text-sm text-muted">{TEMPLATE_PRESETS[d.id as keyof typeof TEMPLATE_PRESETS]?.description}</p>
              <DemoCard id={d.id} />
            </li>
          ))}
        </ul>
      </section>

      {/* Personas */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-extrabold">Faite pour votre métier</h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {PERSONAS.map((p) => (
              <li key={p.title} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                <h3 className="font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Signature email */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 rounded-3xl bg-gradient-to-br from-brand-soft to-white p-8 ring-1 ring-brand/15 lg:grid-cols-2 lg:p-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand ring-1 ring-brand/20">
              <Mail className="h-4 w-4" /> Nouveau
            </span>
            <h2 className="mt-4 text-3xl font-extrabold">Une signature email assortie, en un clic</h2>
            <p className="mt-3 text-muted">
              À partir de votre carte, générez une signature d&apos;email élégante, aux couleurs de votre entreprise, qui renvoie vers votre carte de visite. Chaque email devient une occasion d&apos;être contacté.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Compatible Gmail, Outlook et Apple Mail</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Reprend vos coordonnées et votre charte automatiquement</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Toujours à jour : votre carte change, votre lien reste</li>
            </ul>
            <Link href="/inscription" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-dark">
              Créer ma signature <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-line">
            <div style={{ borderLeft: "3px solid var(--color-brand)", paddingLeft: 14 }}>
              <div className="text-base font-bold text-ink">Camille Moreau</div>
              <div className="text-sm font-semibold text-brand">Menuisière agenceuse · Atelier Moreau</div>
              <div className="mt-2 space-y-0.5 text-[13px] text-muted">
                <div>Mobile <span className="text-ink">06 39 98 12 34</span></div>
                <div>Email <span className="text-ink">contact@atelier-moreau.exemple</span></div>
              </div>
              <span className="mt-3 inline-block rounded-md bg-brand px-3 py-1.5 text-[13px] font-bold text-white">Voir ma carte de visite</span>
            </div>
            <p className="mt-3 text-center text-xs text-muted">Exemple de signature générée.</p>
          </div>
        </div>
      </section>

      {/* Statistiques + formulaire sur mesure */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-extrabold">Transformez vos cartes en vrais outils de contact</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Deux atouts que le papier n&apos;aura jamais : savoir ce qui marche, et recevoir des demandes qualifiées, à votre façon.</p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Statistiques */}
            <div className="rounded-3xl bg-white p-8 ring-1 ring-line">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><BarChart3 className="h-6 w-6" /></div>
              <h3 className="mt-4 text-xl font-extrabold">Des statistiques claires et honnêtes</h3>
              <p className="mt-2 text-sm text-muted">Chaque chiffre est défini, avec ses limites. On ne gonfle rien : vous pilotez sur des données fiables.</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span><strong>Ouvertures</strong> de la carte et <strong>taux de clic</strong> (appels, emails, itinéraire, site…).</span></li>
                <li className="flex items-start gap-2"><Car className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span><strong>D&apos;où viennent vos visiteurs</strong> : créez un QR par support (carte de visite, véhicule, vitrine…) et comparez-les.</span></li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span>Répartition par <strong>appareil, navigateur et pays</strong>, et suivi des <strong>campagnes</strong>.</span></li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span><strong>Sans cookie ni traceur</strong> par défaut : conçu pour le RGPD, sans bandeau intrusif.</span></li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span><strong>Export CSV</strong> pour vos tableaux de bord.</span></li>
              </ul>
            </div>
            {/* Formulaire sur mesure */}
            <div className="rounded-3xl bg-white p-8 ring-1 ring-line">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><Inbox className="h-6 w-6" /></div>
              <h3 className="mt-4 text-xl font-extrabold">Un formulaire de contact sur mesure</h3>
              <p className="mt-2 text-sm text-muted">Composez exactement le formulaire dont vous avez besoin — devis, prise de rendez-vous, rappel… — sans aucune ligne de code.</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span><strong>Vos propres champs</strong> : ajoutez les questions utiles (budget, ville, type de prestation…).</span></li>
                <li className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span>Champs <strong>date</strong>, <strong>liste déroulante</strong>, texte, email, téléphone — idéal pour une <strong>demande de rendez-vous</strong>.</span></li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span>Chaque champ <strong>obligatoire ou facultatif</strong>, avec <strong>anti-spam</strong> intégré.</span></li>
                <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span>Les demandes arrivent <strong>dans votre espace et par email</strong> (aux adresses de votre choix).</span></li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span>Suivi du <strong>statut</strong>, notes privées et <strong>export CSV</strong> des prospects.</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link href="/inscription" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-dark">
              Essayer gratuitement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comparaison */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold">Numérique ou papier ?</h2>
        <ul className="mx-auto mt-8 max-w-2xl space-y-3">
          {COMPARISON.map(([good, , bad]) => (
            <li key={good} className="flex flex-col gap-1 rounded-xl p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 font-semibold"><Check className="h-5 w-5 shrink-0 text-success" /> {good}</span>
              <span className="pl-7 text-sm text-muted sm:pl-0">{bad}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Tarifs teaser */}
      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14 text-white">
          <div>
            <h2 className="text-3xl font-extrabold">Essayez gratuitement pendant 7 jours</h2>
            <p className="mt-2 max-w-xl text-white/85">
              Jusqu&apos;à 3 cartes pendant l&apos;essai, sans carte bancaire. Toutes les fonctions sont incluses dans chaque formule — seuls les quotas changent.
              {entry ? " Des formules mensuelles et annuelles pour tous les besoins." : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/inscription" className="rounded-lg bg-white px-5 py-3 font-semibold text-brand transition hover:bg-brand-soft">Commencer l&apos;essai</Link>
            <Link href="/tarifs" className="rounded-lg px-5 py-3 font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10">Voir les tarifs</Link>
          </div>
        </div>
      </section>

      {/* Création accompagnée */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-surface p-8">
          <div>
            <h2 className="text-2xl font-extrabold">Pas le temps de la faire vous-même ?</h2>
            <p className="mt-2 max-w-xl text-muted">Envoyez-nous un brief : notre équipe réalise la carte, vous la validez avant toute publication.</p>
          </div>
          <Link href="/creation-accompagnee" className="rounded-lg bg-ink px-5 py-3 font-semibold text-white">Découvrir la création accompagnée</Link>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="text-center text-3xl font-extrabold">Questions fréquentes</h2>
        <div className="mt-8 space-y-3">
          {HOME_FAQ.map(([q, a]) => (
            <details key={q} className="rounded-xl p-4 ring-1 ring-line">
              <summary className="cursor-pointer font-semibold">{q}</summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm"><Link href="/faq" className="font-semibold text-brand hover:underline">Voir toutes les questions →</Link></p>
      </section>
    </>
  );
}

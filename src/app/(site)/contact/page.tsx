import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { brand } from "@/lib/config";
import { ContactForm } from "./ContactForm";

export function generateMetadata(): Metadata {
  return pageMeta({ title: 'Contact', description: 'Une question sur les cartes de visite numériques ? Contactez notre équipe.', path: '/contact' });
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Contact</h1>
      <p className="mt-2 text-muted">Une question sur le service, l&apos;offre entreprise ou la création accompagnée ? Écrivez-nous ci-dessous ou à {brand.supportEmail}.</p>
      <ContactForm />
      <p className="mt-6 text-xs text-muted">Vos informations servent uniquement à répondre à votre demande. Voir la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.</p>
    </div>
  );
}

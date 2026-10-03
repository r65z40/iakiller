"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 10) {
      setError("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }
    setPending(true);
    const email = String(fd.get("email")).trim();
    const { error } = await authClient.signUp.email({
      name: String(fd.get("name")).trim(),
      email,
      password,
      callbackURL: "/app/organisations/nouvelle",
    });
    setPending(false);
    if (error) {
      // Message volontairement neutre : ne pas révéler si l'adresse possède déjà un compte.
      setError(error.status === 429 ? "Trop de tentatives. Patientez quelques minutes." : error.status === 422 || error.status === 400 ? "Inscription impossible avec ces informations. Si vous avez déjà un compte, connectez-vous." : "Une erreur est survenue. Réessayez.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <>
        <h1 className="text-2xl font-extrabold">Vérifiez votre messagerie</h1>
        <p className="mt-3 text-[15px]">Un lien de confirmation a été envoyé à <strong>{sentTo}</strong>. Il expire dans une heure.</p>
        <p className="mt-3 text-sm text-muted">L&apos;essai gratuit de 7 jours démarre à la création de votre organisation, après confirmation de l&apos;email. Aucune carte bancaire n&apos;est demandée.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold">Créer un compte</h1>
      <p className="mt-1 text-sm text-muted">7 jours d&apos;essai, jusqu&apos;à 3 cartes, sans carte bancaire.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Prénom et nom" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required maxLength={80} />
        </Field>
        <Field label="Adresse email professionnelle" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Mot de passe" htmlFor="password" hint="10 caractères minimum.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" required className="mt-1 h-4 w-4" />
          <span>J&apos;accepte les <Link href="/conditions" className="text-brand underline" target="_blank">conditions du service</Link> et j&apos;ai pris connaissance de la <Link href="/confidentialite" className="text-brand underline" target="_blank">politique de confidentialité</Link>.</span>
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Création…" : "Créer mon compte"}</Button>
      </form>
      <p className="mt-4 text-center text-sm">Déjà inscrit ? <Link href="/connexion" className="text-brand underline">Se connecter</Link></p>
    </>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Field, Input } from "@/components/ui";
import { safeInternalPath } from "@/lib/validation/urls";

export function SignInForm() {
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"), "/app");
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotVerified(false);
    const fd = new FormData(e.currentTarget);
    const { data, error } = await authClient.signIn.email({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      callbackURL: next,
    });
    setPending(false);
    if (error) {
      if (error.status === 403) {
        setNotVerified(true);
        return;
      }
      setError(error.status === 429 ? "Trop de tentatives. Patientez une minute." : "Email ou mot de passe incorrect.");
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      window.location.assign(`/connexion/2fa?next=${encodeURIComponent(next)}`);
      return;
    }
    window.location.assign(next);
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold">Connexion</h1>
      <p className="mt-1 text-sm text-muted">
        Pas encore de compte ? <Link href="/inscription" className="font-semibold text-brand underline">Essai gratuit de 7 jours</Link>
      </p>
      {params.get("verifie") && <div className="mt-4"><Alert tone="success">Adresse email confirmée. Vous pouvez vous connecter.</Alert></div>}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Adresse email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        {notVerified && (
          <Alert tone="warning" title="Adresse email non confirmée">
            Un nouveau lien de confirmation vient de vous être envoyé. Consultez votre messagerie.
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="text-brand underline">Mot de passe oublié ?</Link>
      </p>
    </>
  );
}

"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    await authClient.requestPasswordReset({ email, redirectTo: "/reinitialiser-mot-de-passe" });
    setDone(true); // réponse identique que le compte existe ou non
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold">Mot de passe oublié</h1>
      {done ? (
        <div className="mt-4"><Alert tone="success">Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé.</Alert></div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Adresse email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" className="w-full">Envoyer le lien</Button>
        </form>
      )}
    </>
  );
}

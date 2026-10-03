"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    const newPassword = String(new FormData(e.currentTarget).get("password"));
    const { error } = await authClient.resetPassword({ newPassword, token });
    setState(error ? "error" : "done");
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold">Nouveau mot de passe</h1>
      {state === "done" ? (
        <div className="mt-4 space-y-4">
          <Alert tone="success">Mot de passe modifié. Toutes vos sessions ont été fermées par sécurité.</Alert>
          <Link href="/connexion" className="font-semibold text-brand underline">Se connecter</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum.">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          {state === "error" && <Alert tone="danger">Lien invalide ou expiré. Refaites une demande.</Alert>}
          <Button type="submit" className="w-full">Enregistrer</Button>
        </form>
      )}
    </>
  );
}

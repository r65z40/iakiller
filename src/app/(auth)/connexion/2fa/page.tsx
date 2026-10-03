"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Field, Input } from "@/components/ui";
import { safeInternalPath } from "@/lib/validation/urls";

export default function TwoFactorPage() {
  const [error, setError] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    const res = useBackup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
    if (res.error) {
      setError("Code invalide ou expiré.");
      return;
    }
    const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/app");
    window.location.assign(next);
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold">Vérification en deux étapes</h1>
      <p className="mt-1 text-sm text-muted">{useBackup ? "Saisissez un de vos codes de secours." : "Saisissez le code à 6 chiffres affiché par votre application d'authentification."}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label={useBackup ? "Code de secours" : "Code"} htmlFor="code">
          <Input id="code" name="code" inputMode={useBackup ? "text" : "numeric"} autoComplete="one-time-code" required autoFocus />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" className="w-full">Valider</Button>
      </form>
      <button type="button" onClick={() => setUseBackup(!useBackup)} className="mt-4 w-full text-center text-sm text-brand underline">
        {useBackup ? "Utiliser l'application d'authentification" : "Utiliser un code de secours"}
      </button>
    </>
  );
}

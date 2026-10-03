"use client";

import QRCode from "qrcode";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Alert, Button, Input, Panel } from "@/components/ui";
import { leaveOrganizationAction } from "../_actions/members";

export function SecurityPanel({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [step, setStep] = useState<"idle" | "scan" | "done">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  return (
    <Panel title="Sécurité du compte">
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold">Double authentification {twoFactorEnabled || step === "done" ? "(activée)" : "(désactivée)"}</p>
          <p className="text-muted">Obligatoire pour les administrateurs de la plateforme, recommandée pour les propriétaires.</p>
          {!twoFactorEnabled && step === "idle" && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-sm">Mot de passe actuel<Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <Button type="button" size="sm" disabled={pending || !password} onClick={() => start(async () => {
                const r = await authClient.twoFactor.enable({ password });
                if (r.error || !r.data || r.data.method !== "totp") { setMsg({ ok: false, text: "Mot de passe incorrect." }); return; }
                setQr(await QRCode.toDataURL(r.data.totpURI, { margin: 2, width: 220 }));
                setCodes(r.data.backupCodes);
                setStep("scan");
              })}>Activer</Button>
            </div>
          )}
          {step === "scan" && (
            <div className="mt-3 space-y-3">
              <p>Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code affiché.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR code de configuration de la double authentification" className="h-48 w-48" />}
              <p className="font-semibold">Codes de secours (à conserver en lieu sûr) :</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-xs">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="flex items-end gap-2">
                <label>Code<Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
                <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
                  const r = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
                  if (r.error) setMsg({ ok: false, text: "Code invalide." });
                  else {
                    // Ferme les autres sessions (ouvertes avec le seul mot de passe, avant la 2FA) :
                    // sans cela elles garderaient leurs droits une fois la 2FA activée.
                    await authClient.revokeOtherSessions().catch(() => undefined);
                    setStep("done");
                    setMsg({ ok: true, text: "Double authentification activée. Les autres sessions ont été fermées." });
                  }
                })}>Vérifier</Button>
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold">Sessions</p>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
            const r = await authClient.revokeOtherSessions();
            setMsg(r.error ? { ok: false, text: "Impossible de fermer les sessions." } : { ok: true, text: "Toutes vos autres sessions ont été fermées." });
          })}>Se déconnecter de tous les autres appareils</Button>
        </div>
        {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      </div>
    </Panel>
  );
}

export function LeaveButton() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => { if (window.confirm("Quitter l'organisation ? Vous perdrez immédiatement l'accès à ses cartes.")) start(async () => { const r = await leaveOrganizationAction(); if (r && !r.ok) setErr(r.error); }); }}>Quitter</Button>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </>
  );
}

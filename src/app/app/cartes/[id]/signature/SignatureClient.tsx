"use client";

import { useMemo, useState } from "react";
import { buildSignatureHtml, type SignatureInput, type SignatureTemplate } from "@/lib/signature/build";
import { Button } from "@/components/ui";

const TEMPLATES: { id: SignatureTemplate; label: string }[] = [
  { id: "classic", label: "Classique" },
  { id: "banner", label: "Barre colorée" },
  { id: "compact", label: "Compacte" },
];

export function SignatureClient({ input }: { input: SignatureInput }) {
  const [template, setTemplate] = useState<SignatureTemplate>("classic");
  const [logoBanner, setLogoBanner] = useState(false);
  const [qr, setQr] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const html = useMemo(() => buildSignatureHtml(input, template, { logoBanner, qr }), [input, template, logoBanner, qr]);

  async function copyRich(): Promise<boolean> {
    try {
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([html], { type: "text/plain" }) }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function onCopy() {
    setMsg((await copyRich()) ? "Signature copiée. Collez-la (Ctrl/Cmd+V) dans les réglages de signature de votre messagerie." : "Copie impossible : utilisez « Copier le code HTML ».");
  }

  async function onGmail() {
    const ok = await copyRich();
    window.open("https://mail.google.com/mail/u/0/#settings/general", "_blank", "noopener");
    setMsg(ok ? "Signature copiée et réglages Gmail ouverts : collez-la dans le champ « Signature », puis enregistrez." : "Ouverture de Gmail : utilisez « Copier le code HTML » si le collage ne garde pas la mise en forme.");
  }

  async function onCopyCode() {
    try {
      await navigator.clipboard.writeText(html);
      setMsg("Code HTML copié.");
    } catch {
      setMsg("Copie impossible.");
    }
  }

  function onDownload() {
    const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Signature</title></head><body>${html}</body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "signature.html";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Fichier signature.html téléchargé.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Style :</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            aria-pressed={template === t.id}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${template === t.id ? "bg-brand text-white ring-brand" : "bg-white ring-line hover:bg-surface"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className={`flex items-center gap-2 ${input.logoUrl ? "" : "text-muted"}`}>
          <input type="checkbox" checked={logoBanner} disabled={!input.logoUrl} onChange={(e) => setLogoBanner(e.target.checked)} /> Logo en bannière
          {!input.logoUrl && <span className="text-xs">(ajoutez un logo visible sur la carte)</span>}
        </label>
        <label className={`flex items-center gap-2 ${input.qrUrl ? "" : "text-muted"}`}>
          <input type="checkbox" checked={qr} disabled={!input.qrUrl} onChange={(e) => setQr(e.target.checked)} /> Mini QR code
          {!input.qrUrl && <span className="text-xs">(publiez la carte pour l&apos;activer)</span>}
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Aperçu</p>
        {/* Le HTML est construit côté serveur/pur et entièrement échappé. */}
        <div className="overflow-x-auto rounded-xl border border-line bg-white p-5" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onCopy}>Copier la signature</Button>
        <Button type="button" onClick={onGmail}>Copier et ouvrir Gmail</Button>
        <Button type="button" variant="secondary" onClick={onCopyCode}>Copier le code HTML</Button>
        <Button type="button" variant="secondary" onClick={onDownload}>Télécharger (.html)</Button>
      </div>
      {msg && <p className="text-sm text-success">{msg}</p>}

      <details className="rounded-xl bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Comment l&apos;installer ?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><strong>Gmail</strong> : « Copier et ouvrir Gmail » → collez (Ctrl/Cmd+V) dans le champ « Signature » → Enregistrer les modifications.</li>
          <li><strong>Outlook</strong> : Fichier → Options → Courrier → Signatures → collez dans l&apos;éditeur.</li>
          <li><strong>Apple Mail</strong> : Réglages → Signatures → décochez « Toujours utiliser la police par défaut » puis collez.</li>
        </ul>
        <p className="mt-2 text-muted">« Copier la signature » conserve la mise en forme ; « Copier le code HTML » et « Télécharger » servent aux outils qui demandent du code.</p>
      </details>
    </div>
  );
}

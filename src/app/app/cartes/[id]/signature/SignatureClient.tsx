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
  const [msg, setMsg] = useState<string | null>(null);
  const html = useMemo(() => buildSignatureHtml(input, template), [input, template]);

  async function copyRich() {
    try {
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([html], { type: "text/plain" }) }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setMsg("Signature copiée. Collez-la dans les paramètres de signature de votre messagerie.");
    } catch {
      setMsg("Copie impossible : utilisez « Copier le code HTML » ci-dessous.");
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(html);
      setMsg("Code HTML copié.");
    } catch {
      setMsg("Copie impossible.");
    }
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

      <div>
        <p className="mb-2 text-sm font-semibold">Aperçu</p>
        {/* Aperçu rendu dans un cadre ; le HTML est construit côté serveur et entièrement échappé. */}
        <div className="overflow-x-auto rounded-xl border border-line bg-white p-5" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={copyRich}>Copier la signature</Button>
        <Button type="button" variant="secondary" onClick={copyCode}>Copier le code HTML</Button>
      </div>
      {msg && <p className="text-sm text-success">{msg}</p>}

      <details className="rounded-xl bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Comment l&apos;installer ?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><strong>Gmail</strong> : Paramètres → Général → Signature → collez (Ctrl/Cmd+V) dans le cadre.</li>
          <li><strong>Outlook</strong> : Fichier → Options → Courrier → Signatures → collez dans l&apos;éditeur.</li>
          <li><strong>Apple Mail</strong> : Réglages → Signatures → décochez « Toujours utiliser la police par défaut » puis collez.</li>
        </ul>
        <p className="mt-2 text-muted">Astuce : « Copier la signature » conserve la mise en forme ; « Copier le code HTML » sert aux outils qui demandent du code.</p>
      </details>
    </div>
  );
}

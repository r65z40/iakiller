"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function PromoVideoField({ hasVideo }: { hasVideo: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/promo-video", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMsg({ ok: true, text: "Vidéo enregistrée et affichée sur la page d'accueil." });
        if (inputRef.current) inputRef.current.value = "";
        start(() => router.refresh());
      } else {
        setMsg({ ok: false, text: data.error ?? "Envoi refusé." });
      }
    } catch {
      setMsg({ ok: false, text: "Connexion impossible. Réessayez." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Retirer la vidéo de la page d'accueil ?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/promo-video", { method: "DELETE" });
      if (res.ok) { setMsg({ ok: true, text: "Vidéo retirée." }); start(() => router.refresh()); }
      else setMsg({ ok: false, text: "Suppression refusée." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="mt-6 rounded-lg border border-line p-4">
      <legend className="px-1 text-sm font-bold">Vidéo de présentation (page d&apos;accueil)</legend>
      <p className="text-xs text-muted">Affichée sous l&apos;accroche de la page d&apos;accueil. Formats acceptés : MP4 ou WebM, 50 Mo maximum. Pour un chargement rapide, visez une vidéo courte et compressée.</p>

      {hasVideo && (
        <div className="mt-3">
          <video src="/video-accueil" controls playsInline className="w-full max-w-md rounded-lg ring-1 ring-line" />
          <div className="mt-2">
            <Button size="sm" variant="ghost" type="button" onClick={remove} disabled={busy || pending}>Retirer la vidéo</Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm"
          disabled={busy || pending}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          className="text-sm"
        />
        {(busy || pending) && <span className="text-sm text-muted">Envoi en cours…</span>}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </fieldset>
  );
}

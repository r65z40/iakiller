"use client";

import { useRef, useState } from "react";
import { Crop, X } from "lucide-react";
import { cropRect } from "@/lib/media/crop";
import type { LibraryItem } from "./MediaPicker";

/**
 * Recadrage par zoom et position (curseurs utilisables au clavier). L'aperçu applique
 * exactement le calcul du serveur ; l'image d'origine est conservée.
 */
export function CropButton({ item, aspect, onCropped, label }: { item: LibraryItem; aspect: number; onCropped: (item: LibraryItem) => void; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0.5);
  const [y, setY] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const W = item.width ?? 0;
  const H = item.height ?? 0;
  if (!W || !H) return null;
  const r = cropRect(W, H, { aspect, zoom, x, y });

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${item.id}/crop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aspect, zoom, x, y }) });
      const data = (await res.json().catch(() => ({}))) as { media?: { id: string; url: string; originalName: string; sizeBytes: number; width: number | null; height: number | null }; error?: string };
      if (!res.ok || !data.media) {
        setError(data.error ?? "Recadrage impossible.");
        return;
      }
      onCropped({ id: data.media.id, kind: "image", url: data.media.url, name: data.media.originalName, sizeBytes: data.media.sizeBytes, width: data.media.width, height: data.media.height });
      dialog.current?.close();
    } catch {
      setError("Connexion perdue.");
    } finally {
      setBusy(false);
    }
  }

  const slider = (lbl: string, value: number, set: (v: number) => void, min: number, max: number, step: number) => (
    <label className="block text-sm font-semibold">
      {lbl}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full accent-[#0047BB]" />
    </label>
  );

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface">
        <Crop size={14} aria-hidden /> Recadrer
      </button>
      <dialog ref={dialog} className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/40" aria-label={`Recadrer : ${label}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-bold">Recadrer · {label}</h3>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded p-1 hover:bg-surface" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-4">
          <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-lg bg-surface ring-1 ring-line" style={{ aspectRatio: String(aspect) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="Aperçu du recadrage" className="absolute max-w-none select-none" draggable={false}
              style={{ width: `${(W / r.width) * 100}%`, height: `${(H / r.height) * 100}%`, left: `${(-r.left / r.width) * 100}%`, top: `${(-r.top / r.height) * 100}%` }} />
          </div>
          {slider("Zoom", zoom, setZoom, 1, 4, 0.05)}
          {slider("Position horizontale", x, setX, 0, 1, 0.01)}
          {slider("Position verticale", y, setY, 0, 1, 0.01)}
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-lg px-4 text-sm font-semibold ring-1 ring-line">Annuler</button>
            <button type="button" onClick={apply} disabled={busy} className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Recadrage…" : "Appliquer"}</button>
          </div>
          <p className="text-xs text-muted">Une nouvelle image est créée ; l&apos;originale reste dans vos médias.</p>
        </div>
      </dialog>
    </>
  );
}

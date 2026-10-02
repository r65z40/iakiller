"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Upload, X } from "lucide-react";

export interface LibraryItem {
  id: string;
  kind: "image" | "document";
  url: string;
  name: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export function useUpload(onUploaded: (item: LibraryItem) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File, purpose: "image" | "document") {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { media?: { id: string; kind: "image" | "document"; url: string; originalName: string; sizeBytes: number; width: number | null; height: number | null }; error?: string };
      if (!res.ok || !data.media) {
        setError(data.error ?? "Envoi impossible.");
        return null;
      }
      const item: LibraryItem = { id: data.media.id, kind: data.media.kind, url: data.media.url, name: data.media.originalName, sizeBytes: data.media.sizeBytes, width: data.media.width, height: data.media.height };
      onUploaded(item);
      return item;
    } catch {
      setError("Connexion perdue pendant l'envoi.");
      return null;
    } finally {
      setUploading(false);
    }
  }
  return { upload, uploading, error };
}

/** Sélecteur de média : choisir dans la bibliothèque de l'organisation ou envoyer un fichier. */
export function MediaPicker({
  kind,
  library,
  value,
  onChange,
  onUploaded,
  label,
  allowNone = true,
  disabled,
}: {
  kind: "image" | "document";
  library: LibraryItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  onUploaded: (item: LibraryItem) => void;
  label: string;
  allowNone?: boolean;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useUpload(onUploaded);
  const items = library.filter((m) => m.kind === kind);
  const current = items.find((m) => m.id === value);

  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-1 flex items-center gap-3">
        {current ? (
          kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-line" />
          ) : (
            <span className="flex items-center gap-2 text-sm"><FileText size={16} aria-hidden />{current.name}</span>
          )
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface text-muted ring-1 ring-line"><ImagePlus size={18} aria-hidden /></span>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled} onClick={() => dialog.current?.showModal()} className="min-h-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface disabled:opacity-50">
            {current ? "Changer" : "Choisir"}
          </button>
          {current && allowNone && (
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="min-h-9 rounded-lg px-3 text-sm text-muted hover:bg-surface disabled:opacity-50">Retirer</button>
          )}
        </div>
      </div>

      <dialog ref={dialog} className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-xl p-0 backdrop:bg-black/40" aria-label={label}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-bold">{label}</h3>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded p-1 hover:bg-surface" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <input
            ref={input}
            type="file"
            accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : "application/pdf"}
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const item = await upload(f, kind);
              if (item) {
                onChange(item.id);
                dialog.current?.close();
              }
            }}
          />
          <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line text-sm font-semibold hover:bg-surface">
            <Upload size={16} aria-hidden />
            {uploading ? "Envoi en cours…" : kind === "image" ? "Envoyer une image (JPEG, PNG, WebP – 8 Mo max.)" : "Envoyer un PDF (15 Mo max.)"}
          </button>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun fichier dans votre bibliothèque.</p>
          ) : (
            <ul className={`mt-4 grid gap-2 ${kind === "image" ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1"}`}>
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(m.id);
                      dialog.current?.close();
                    }}
                    aria-pressed={m.id === value}
                    className={`w-full rounded-lg text-left ring-2 ${m.id === value ? "ring-brand" : "ring-transparent hover:ring-line"}`}
                  >
                    {kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.name} className="aspect-square w-full rounded-lg object-cover" />
                    ) : (
                      <span className="flex items-center gap-2 p-2 text-sm"><FileText size={16} aria-hidden />{m.name}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </div>
  );
}

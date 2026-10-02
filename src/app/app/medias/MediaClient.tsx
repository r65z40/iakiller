"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useUpload } from "@/components/editor/MediaPicker";
import { Button } from "@/components/ui";
import { deleteMediaAction } from "../_actions/brand";

export function UploadBox() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useUpload(() => router.refresh());
  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" className="sr-only" id="upload"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await upload(f, f.type === "application/pdf" ? "document" : "image");
        }} />
      <Button type="button" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? "Envoi…" : "Envoyer un fichier"}</Button>
      <p className="mt-2 text-xs text-muted">Images : 8 Mo max., métadonnées (EXIF, localisation) supprimées automatiquement. PDF : 15 Mo max. SVG et autres formats refusés.</p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function MediaActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={pending} className="mt-1 text-danger underline" onClick={() => {
        if (!window.confirm("Supprimer ce fichier ?")) return;
        start(async () => {
          const r = await deleteMediaAction(id);
          if (!r.ok) setErr(r.error);
        });
      }}>Supprimer</button>
      {err && <p role="alert" className="mt-1 text-danger">{err}</p>}
    </>
  );
}

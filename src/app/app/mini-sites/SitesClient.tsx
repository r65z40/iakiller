"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { SITE_TEMPLATES } from "@/lib/sites/defaults";
import { createSiteAction, deleteSiteAction } from "@/app/app/_actions/sites";

export function CreateSite() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { title: String(fd.get("title") ?? ""), template: String(fd.get("template") ?? "vierge") };
    setError(null);
    start(async () => {
      const r = await createSiteAction(input);
      if (r.ok) router.push(`/app/mini-sites/${r.data}`);
      else setError(r.error);
    });
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", "sm")}>+ Nouveau mini-site</button>;

  const field = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="new-site-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="new-site-title" className="text-lg font-bold">Nouveau mini-site</h2>
        <label className="block text-[13px] font-semibold">Nom du mini-site<input name="title" required maxLength={120} placeholder="Ex. Plomberie Durand" className={field} /></label>
        <fieldset>
          <legend className="text-[13px] font-semibold">Modèle de départ</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {SITE_TEMPLATES.map((t, i) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2 text-sm has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand">
                <input type="radio" name="template" value={t.id} defaultChecked={i === 0} className="mt-0.5" />
                <span><span className="block font-semibold">{t.label}</span><span className="block text-xs text-muted">{t.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-[#b00020]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>Annuler</button>
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>{pending ? "Création…" : "Créer et ouvrir l'éditeur"}</button>
        </div>
      </form>
    </div>
  );
}

export function SiteActions({ siteId, title }: { siteId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => { if (window.confirm(`Supprimer définitivement le mini-site « ${title} » ?`)) start(async () => { await deleteSiteAction(siteId); router.refresh(); }); }}
      className="text-sm text-muted hover:text-ink"
    >
      Supprimer
    </button>
  );
}

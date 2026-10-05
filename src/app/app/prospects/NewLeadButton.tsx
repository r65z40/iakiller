"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { createLeadAction } from "./actions";

export function NewLeadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      company: String(fd.get("company") ?? ""),
      message: String(fd.get("message") ?? ""),
    };
    start(async () => {
      const r = await createLeadAction(input);
      if (r.ok) { setOpen(false); router.push(`/app/prospects/${r.data}`); }
      else setError(r.error);
    });
  }

  const field = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm";

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>+ Nouveau prospect</button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="new-lead-title" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="new-lead-title" className="text-lg font-bold">Nouveau prospect</h2>
        <p className="text-sm text-muted">Pour une demande reçue par téléphone, en salon, ou par un autre canal.</p>
        <label className="block text-[13px] font-semibold">Nom<input name="name" maxLength={120} autoComplete="name" className={field} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[13px] font-semibold">Email<input name="email" type="email" maxLength={254} className={field} /></label>
          <label className="block text-[13px] font-semibold">Téléphone<input name="phone" type="tel" maxLength={40} className={field} /></label>
        </div>
        <label className="block text-[13px] font-semibold">Société<input name="company" maxLength={120} className={field} /></label>
        <label className="block text-[13px] font-semibold">Demande<textarea name="message" rows={3} maxLength={2000} className={`${field} py-2`} /></label>
        {error && <p role="alert" className="text-sm text-[#b00020]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>Annuler</button>
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>{pending ? "Création…" : "Créer"}</button>
        </div>
      </form>
    </div>
  );
}

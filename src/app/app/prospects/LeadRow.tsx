"use client";

import { useState, useTransition } from "react";
import { Badge, buttonClass } from "@/components/ui";
import { deleteLeadAction, updateLeadAction } from "../_actions/members";

interface LeadView { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; message: string | null; status: string; notes: string; marketingConsent: boolean; createdAt: string; cardTitle: string }

export function LeadRow({ lead, canDelete }: { lead: LeadView; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(lead.notes);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{lead.name || "Sans nom"} {lead.company && <span className="font-normal text-muted">· {lead.company}</span>}</p>
          <p className="text-sm">
            {lead.email && <a href={`mailto:${lead.email}`} className="text-brand underline">{lead.email}</a>}
            {lead.email && lead.phone && " · "}
            {lead.phone && <a href={`tel:${lead.phone}`} className="text-brand underline">{lead.phone}</a>}
          </p>
          <p className="text-xs text-muted">{lead.createdAt} · via « {lead.cardTitle} » · {lead.marketingConsent ? "accord marketing donné" : "pas d'accord marketing"}</p>
        </div>
        <div className="flex items-center gap-2">
          {lead.status === "new" && <Badge tone="brand">Nouveau</Badge>}
          <label className="sr-only" htmlFor={`st-${lead.id}`}>Statut</label>
          <select id={`st-${lead.id}`} defaultValue={lead.status} disabled={pending} onChange={(e) => start(async () => { await updateLeadAction(lead.id, { status: e.target.value }); })} className="min-h-9 rounded-lg border border-line px-2 text-sm">
            <option value="new">Nouveau</option><option value="contacted">Contacté</option><option value="done">Traité</option>
          </select>
        </div>
      </div>
      {lead.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm">{lead.message}</p>}
      <div className="mt-3">
        <label htmlFor={`notes-${lead.id}`} className="text-xs font-semibold text-muted">Notes privées</label>
        <textarea id={`notes-${lead.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={4000} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-sm" />
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => start(async () => { const r = await updateLeadAction(lead.id, { notes }); setSaved(r.ok ? "Notes enregistrées." : r.error); })}>Enregistrer les notes</button>
          {canDelete && <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => { if (window.confirm("Supprimer définitivement cette demande ?")) start(async () => { await deleteLeadAction(lead.id); }); }}>Supprimer</button>}
          {saved && <span role="status" className="self-center text-xs text-muted">{saved}</span>}
        </div>
      </div>
    </li>
  );
}

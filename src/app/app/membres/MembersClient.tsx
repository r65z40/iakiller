"use client";

import { useState, useTransition } from "react";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { Badge, buttonClass } from "@/components/ui";
import { changeRoleAction, removeMemberAction, revokeInvitationAction } from "../_actions/members";

export function MemberRow({ id, name, email, role, billing, isSelf, actorRole, canManage }: { id: string; name: string; email: string; role: OrgRole; billing: boolean; isSelf: boolean; actorRole: OrgRole; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const editable = canManage && !isSelf && role !== "owner" && !(actorRole === "manager" && role === "manager");
  const exec = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : (r.error ?? "Erreur")); });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold">{name} {isSelf && <span className="text-sm font-normal text-muted">(vous)</span>}</p>
        <p className="text-sm text-muted">{email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            <label className="sr-only" htmlFor={`role-${id}`}>Rôle de {name}</label>
            <select id={`role-${id}`} defaultValue={role} disabled={pending} onChange={(e) => exec(() => changeRoleAction(id, e.target.value as OrgRole, false))} className="min-h-9 rounded-lg border border-line px-2 text-sm">
              <option value="member">{ROLE_LABELS.member}</option>
              <option value="manager">{ROLE_LABELS.manager}</option>
            </select>
            {actorRole === "owner" && role === "manager" && (
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" defaultChecked={billing} onChange={(e) => exec(() => changeRoleAction(id, "manager", e.target.checked))} className="h-4 w-4" /> Accès facturation
              </label>
            )}
            <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => {
              if (!window.confirm(`Retirer ${name} de l'organisation ? Ses accès sont révoqués immédiatement.`)) return;
              const disable = window.confirm("Désactiver aussi les cartes qui lui étaient attribuées (salarié sortant) ?\nOK = désactiver, Annuler = les conserver actives.");
              exec(() => removeMemberAction(id, disable));
            }}>Retirer</button>
          </>
        ) : (
          <Badge tone={role === "owner" ? "brand" : "neutral"}>{ROLE_LABELS[role]}{billing && role === "manager" ? " · facturation" : ""}</Badge>
        )}
      </div>
      {msg && <p role="alert" className="w-full text-sm font-semibold text-danger">{msg}</p>}
    </li>
  );
}

export function InvitationRow({ id, email, role, expires, canManage }: { id: string; email: string; role: string; expires: string; canManage: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <span><strong>{email}</strong> · {role} · expire le {expires}</span>
      {canManage && <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => start(async () => { await revokeInvitationAction(id); })}>Révoquer</button>}
    </li>
  );
}

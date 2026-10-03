"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { archiveCardAction, deleteCardAction, duplicateCardAction, setCardDisabledAction, unarchiveCardAction } from "../_actions/cards";

export function CardRowActions({ card, canManage }: { card: { id: string; status: string; disabled: boolean; publicUrl: string }; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const exec = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, confirmText?: string) => () => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? null : (r.error ?? "Erreur"));
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {card.status !== "archived" && <Link href={`/app/cartes/${card.id}`} className={buttonClass("primary", "sm")}>Modifier</Link>}
      {card.status === "published" && !card.disabled && (
        <a href={card.publicUrl} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>Voir</a>
      )}
      {canManage && card.status !== "archived" && (
        <>
          <button type="button" disabled={pending} onClick={exec(() => duplicateCardAction(card.id))} className={buttonClass("secondary", "sm")}>Dupliquer</button>
          <button type="button" disabled={pending} onClick={exec(() => setCardDisabledAction(card.id, !card.disabled), card.disabled ? undefined : "Désactiver la carte ? Elle deviendra immédiatement indisponible (page, QR code et médias).")} className={buttonClass("secondary", "sm")}>
            {card.disabled ? "Réactiver" : "Désactiver"}
          </button>
          <button type="button" disabled={pending} onClick={exec(() => archiveCardAction(card.id), "Archiver cette carte ? Elle sera retirée de la publication mais son contenu est conservé.")} className={buttonClass("ghost", "sm")}>Archiver</button>
        </>
      )}
      {canManage && card.status === "archived" && (
        <>
          <button type="button" disabled={pending} onClick={exec(() => unarchiveCardAction(card.id))} className={buttonClass("secondary", "sm")}>Désarchiver</button>
          <button type="button" disabled={pending} onClick={exec(() => deleteCardAction(card.id), "Supprimer définitivement cette carte, ses versions et ses statistiques ? Cette action est irréversible.")} className={buttonClass("danger", "sm")}>Supprimer</button>
        </>
      )}
      {message && <p role="alert" className="w-full text-sm font-semibold text-danger">{message}</p>}
    </div>
  );
}

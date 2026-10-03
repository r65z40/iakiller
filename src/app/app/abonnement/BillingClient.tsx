"use client";

import { useState, useTransition } from "react";
import { Alert, Button, buttonClass } from "@/components/ui";
import { PriceTag } from "@/components/billing/PriceTag";
import { formatMoney } from "@/lib/format";
import { cancelAction, changePlanAction, checkoutAction, portalAction, previewChangeAction } from "../_actions/billing";

interface PriceView { id: string; amountCents: number; taxBehavior: string; sellable: boolean }
interface PlanView { id: string; name: string; description: string; quotas: { cards: number; storageMb: number; members: number }; monthly: PriceView | null; yearly: PriceView | null }

export function PlanPicker({ plans, currentPriceId, hasLive, canManage, billingEnabled }: { plans: PlanView[]; currentPriceId: string | null; hasLive: boolean; canManage: boolean; billingEnabled: boolean }) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ priceId: string; amountDueCents: number; currency: string; prorationDate: number; rule: string; blocked: string | null; newPlanName: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <div>
      <div role="radiogroup" aria-label="Périodicité" className="mb-4 inline-flex rounded-lg bg-surface p-1">
        {(["month", "year"] as const).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`min-h-9 rounded-md px-4 text-sm font-semibold ${interval === i ? "bg-white shadow-sm" : "text-muted"}`}>
            {i === "month" ? "Mensuel" : "Annuel"}
          </button>
        ))}
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const price = interval === "month" ? p.monthly : p.yearly;
          const current = price && price.id === currentPriceId;
          return (
            <li key={p.id} className={`flex flex-col rounded-xl p-5 ring-1 ${current ? "ring-2 ring-brand" : "ring-line"}`}>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <div className="my-4"><PriceTag monthly={p.monthly} yearly={p.yearly} interval={interval} /></div>
              <ul className="mb-4 space-y-1 text-sm">
                <li>{p.quotas.cards} carte(s)</li>
                <li>{p.quotas.members} membre(s)</li>
                <li>{p.quotas.storageMb >= 1024 ? `${(p.quotas.storageMb / 1024).toFixed(0)} Go` : `${p.quotas.storageMb} Mo`} de stockage</li>
              </ul>
              <div className="mt-auto">
                {current ? (
                  <p className="text-sm font-semibold text-brand">Formule actuelle</p>
                ) : !canManage ? null : (
                  <Button type="button" className="w-full" disabled={pending || !price?.sellable || !billingEnabled}
                    onClick={() => start(async () => {
                      setError(null);
                      if (!price) return;
                      if (!hasLive) {
                        const r = await checkoutAction(price.id);
                        if (r && !r.ok) setError(r.error);
                        return;
                      }
                      const r = await previewChangeAction(price.id);
                      if (r.ok) setPreview({ priceId: price.id, ...r.data });
                      else setError(r.error);
                    })}>
                    {!price?.sellable ? "Bientôt disponible" : hasLive ? "Voir le changement" : "Souscrire"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}
      {done && <div className="mt-4"><Alert tone="success">{done}</Alert></div>}
      {preview && (
        <div className="mt-4 rounded-xl bg-surface p-4 ring-1 ring-line">
          <h3 className="font-bold">Passer à « {preview.newPlanName} »</h3>
          <p className="mt-1 text-sm">Montant facturé maintenant : <strong>{formatMoney(preview.amountDueCents, preview.currency)}</strong></p>
          <p className="text-sm">Date d&apos;effet : immédiate.</p>
          <p className="text-sm text-muted">{preview.rule}</p>
          {preview.blocked && <div className="mt-2"><Alert tone="warning">{preview.blocked}</Alert></div>}
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={pending || !!preview.blocked} onClick={() => start(async () => {
              const r = await changePlanAction(preview.priceId);
              if (r.ok) { setDone(r.data); setPreview(null); } else setError(r.error);
            })}>Confirmer le changement</Button>
            <Button type="button" variant="secondary" onClick={() => setPreview(null)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubscriptionControls({ cancelAtPeriodEnd, periodEnd, billingEnabled }: { cancelAtPeriodEnd: boolean; periodEnd: string | null; billingEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!billingEnabled || pending} className={buttonClass("secondary", "sm")} onClick={() => start(async () => { const r = await portalAction(); if (r && !r.ok) setMsg({ ok: false, text: r.error }); })}>Moyen de paiement et factures (Stripe)</button>
        {cancelAtPeriodEnd ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => { const r = await cancelAction(false); setMsg(r.ok ? { ok: true, text: r.data } : { ok: false, text: r.error }); })}>Annuler la résiliation</Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => {
            if (!window.confirm(`Résilier l'abonnement ? Vos cartes resteront accessibles jusqu'au ${periodEnd ?? "terme de la période payée"}, puis deviendront indisponibles. Vos contenus ne sont pas supprimés automatiquement.`)) return;
            start(async () => { const r = await cancelAction(true); setMsg(r.ok ? { ok: true, text: r.data } : { ok: false, text: r.error }); });
          }}>Résilier à la fin de la période</Button>
        )}
      </div>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
    </div>
  );
}

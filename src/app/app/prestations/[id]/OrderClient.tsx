"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Panel, Textarea } from "@/components/ui";
import { approveDeliveryAction, orderMessageAction, payServiceOrderAction, refundRequestAction, requestRevisionAction } from "../../_actions/billing";

export function OrderClient({ orderId, status, canPay, paymentUnavailableReason, paid, refundRequested }: { orderId: string; status: string; canPay: boolean; paymentUnavailableReason: string | null; paid: boolean; refundRequested: boolean }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const exec = (fn: () => Promise<{ ok: true; data: string } | { ok: false; error: string } | undefined>) => start(async () => {
    const r = await fn();
    if (r) setMsg(r.ok ? { ok: true, text: r.data } : { ok: false, text: r.error });
    if (r?.ok) setText("");
  });
  return (
    <Panel title="Actions">
      <div className="space-y-4">
        {(status === "requested" || status === "awaiting_payment") && (
          <div>
            <Button type="button" disabled={!canPay || pending} onClick={() => exec(async () => { const r = await payServiceOrderAction(orderId); return r && !r.ok ? r : undefined; })}>Payer la prestation</Button>
            {paymentUnavailableReason && <p className="mt-2 text-sm text-warning">{paymentUnavailableReason}</p>}
          </div>
        )}
        {status === "client_review" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => exec(() => approveDeliveryAction(orderId))}>Valider la carte</Button>
            <Button type="button" variant="secondary" disabled={pending || text.trim().length < 5} onClick={() => exec(() => requestRevisionAction(orderId, text))}>Demander une correction (détaillez ci-dessous)</Button>
          </div>
        )}
        <div>
          <label htmlFor="msg" className="text-sm font-semibold">Message à l&apos;équipe</label>
          <Textarea id="msg" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
          <Button type="button" variant="secondary" size="sm" className="mt-2" disabled={pending || !text.trim()} onClick={() => exec(() => orderMessageAction(orderId, text))}>Envoyer le message</Button>
        </div>
        {paid && !refundRequested && (
          <button type="button" className="text-sm text-muted underline" onClick={() => {
            const note = window.prompt("Motif de la demande de remboursement :");
            if (note) exec(() => refundRequestAction(orderId, note));
          }}>Demander un remboursement</button>
        )}
        {refundRequested && <p className="text-sm text-muted">Demande de remboursement transmise ; elle est étudiée au cas par cas par l&apos;équipe.</p>}
        {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      </div>
    </Panel>
  );
}

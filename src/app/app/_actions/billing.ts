"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as billing from "@/lib/billing/service";
import * as orders from "@/lib/services/orders";

export async function checkoutAction(planPriceId: string) {
  const r = await run(async () => billing.startCheckout(await requireOrgAction("billing.manage"), planPriceId));
  if (r.ok) redirect(r.data);
  return r;
}

export async function portalAction() {
  const r = await run(async () => billing.openBillingPortal(await requireOrgAction("billing.manage")));
  if (r.ok) redirect(r.data);
  return r;
}

export async function previewChangeAction(planPriceId: string) {
  return run(async () => billing.previewPlanChange(await requireOrgAction("billing.manage"), planPriceId));
}

export async function changePlanAction(planPriceId: string, prorationDate: number) {
  return run(async () => {
    await billing.changePlan(await requireOrgAction("billing.manage"), planPriceId, prorationDate);
    revalidatePath("/app", "layout");
    return "Formule modifiée.";
  });
}

export async function cancelAction(cancel: boolean) {
  return run(async () => {
    await billing.setCancelAtPeriodEnd(await requireOrgAction("billing.manage"), cancel);
    revalidatePath("/app", "layout");
    return cancel ? "Résiliation programmée à la fin de la période payée." : "Résiliation annulée.";
  });
}

export async function createServiceOrderAction(_prev: unknown, fd: FormData) {
  const r = await run(async () =>
    orders.createServiceOrder(await requireOrgAction("service.order"), String(fd.get("offerId") ?? ""), {
      activity: String(fd.get("activity") ?? ""),
      people: String(fd.get("people") ?? ""),
      style: String(fd.get("style") ?? ""),
      links: String(fd.get("links") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    }),
  );
  if (r.ok) redirect(`/app/prestations/${r.data.id}`);
  return r;
}

export async function payServiceOrderAction(orderId: string) {
  const r = await run(async () => orders.startServicePayment(await requireOrgAction("service.order"), orderId, billing.ensureStripeCustomer));
  if (r.ok) redirect(r.data);
  return r;
}

async function orderOp(orderId: string, fn: (ctx: Awaited<ReturnType<typeof requireOrgAction>>) => Promise<unknown>, msg: string) {
  return run(async () => {
    await fn(await requireOrgAction("service.order"));
    revalidatePath(`/app/prestations/${orderId}`);
    return msg;
  });
}

export async function approveDeliveryAction(orderId: string) {
  return orderOp(orderId, (ctx) => orders.approveDelivery(ctx, orderId), "Livraison validée. Vous pouvez publier la carte depuis l'éditeur.");
}
export async function requestRevisionAction(orderId: string, message: string) {
  return orderOp(orderId, (ctx) => orders.requestRevision(ctx, orderId, message), "Demande de correction envoyée.");
}
export async function orderMessageAction(orderId: string, message: string) {
  return orderOp(orderId, (ctx) => orders.addOrderMessage(ctx, orderId, message), "Message envoyé.");
}
export async function refundRequestAction(orderId: string, note: string) {
  return orderOp(orderId, (ctx) => orders.requestRefund(ctx, orderId, note), "Demande transmise à l'équipe ; elle sera étudiée au cas par cas.");
}

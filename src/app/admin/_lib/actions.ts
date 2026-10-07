"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE, requireStaffAction } from "@/lib/context";
import { DomainError } from "@/lib/errors";
import * as admin from "@/lib/admin/service";
import * as orders from "@/lib/services/orders";
import * as support from "@/lib/support/service";
import type { PlatformPermission } from "@/lib/permissions";
import { listPlans } from "@/lib/billing/service";
import { suggestedAnnualCents } from "@/lib/billing/pricing";
import { getSettings } from "@/lib/settings/store";

async function act(path: string, permission: PlatformPermission, fn: (staff: Awaited<ReturnType<typeof requireStaffAction>>) => Promise<string>) {
  let target: string;
  try {
    const staff = await requireStaffAction(permission);
    const msg = await fn(staff);
    target = `${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`;
  } catch (e) {
    const msg = e instanceof DomainError ? e.message : "Action refusée ou erreur inattendue.";
    if (!(e instanceof DomainError)) console.error("[admin]", e);
    target = `${path}${path.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(msg)}`;
  }
  redirect(target);
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const n = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);

export async function suspendOrgAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/organisations/${id}`, "platform.orgs.suspend", async (st) => {
    const suspend = s(fd, "suspend") === "1";
    await admin.setOrganizationSuspended(st, id, suspend, s(fd, "reason"));
    return suspend ? "Organisation suspendue." : "Organisation rétablie.";
  });
}

export async function suspendCardAction(fd: FormData) {
  await act(`/admin/organisations/${s(fd, "orgId")}`, "platform.cards.suspend", async (st) => {
    const suspend = s(fd, "suspend") === "1";
    await admin.setCardSuspended(st, s(fd, "cardId"), suspend, s(fd, "reason"));
    return suspend ? "Carte suspendue." : "Carte rétablie.";
  });
}

export async function suspendSiteAction(fd: FormData) {
  await act(`/admin/organisations/${s(fd, "orgId")}`, "platform.cards.suspend", async (st) => {
    const suspend = s(fd, "suspend") === "1";
    await admin.setSiteSuspended(st, s(fd, "siteId"), suspend, s(fd, "reason"));
    return suspend ? "Mini-site suspendu." : "Mini-site rétabli.";
  });
}

export async function syncBillingAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/organisations/${id}`, "platform.billing.sync", async (st) => `${await admin.syncOrganizationBilling(st, id)} abonnement(s) resynchronisé(s).`);
}

export async function grantAccessAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/organisations/${id}`, "platform.support.access", async (st) => {
    await support.grantSupportAccess(st, id, s(fd, "reason"), n(fd, "hours"));
    return "Accès d'assistance ouvert ; le propriétaire a été notifié.";
  });
}

/** Entre dans l'espace client en mode assistance (bandeau visible, actions journalisées). */
export async function enterSupportModeAction(fd: FormData) {
  await requireStaffAction("platform.support.access");
  (await cookies()).set(ACTIVE_ORG_COOKIE, s(fd, "id"), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.APP_URL?.startsWith("https://") });
  redirect("/app");
}

export async function disableUserAction(fd: FormData) {
  await act("/admin/utilisateurs", "platform.orgs.suspend", async (st) => {
    const disable = s(fd, "disable") === "1";
    await admin.setUserDisabled(st, s(fd, "id"), disable);
    return disable ? "Compte désactivé, sessions fermées." : "Compte réactivé.";
  });
}

export async function syncStripePricesAction() {
  await act("/admin/plans", "platform.plans.manage", async (st) => {
    const r = await admin.syncStripePrices(st);
    return r.created === 0
      ? `Aucun prix à créer : ${r.skipped} prix déjà associé(s) à Stripe.`
      : `${r.created} prix créé(s) dans Stripe${r.skipped ? `, ${r.skipped} déjà associé(s)` : ""}. ${r.details.join(" · ")}`;
  });
}

export async function updatePlanAction(fd: FormData) {
  await act("/admin/plans", "platform.plans.manage", async (st) => {
    await admin.updatePlan(st, s(fd, "id"), { name: s(fd, "name"), description: s(fd, "description"), cardQuota: n(fd, "cardQuota"), storageQuotaMb: n(fd, "storageQuotaMb"), memberQuota: n(fd, "memberQuota"), isActive: fd.get("isActive") === "on", isDemo: fd.get("isDemo") === "on" });
    return "Plan enregistré.";
  });
}

export async function setPriceAction(fd: FormData) {
  await act("/admin/plans", "platform.plans.manage", async (st) => {
    const interval = s(fd, "interval") === "year" ? "year" : "month";
    let amountCents = Math.round(Number(s(fd, "amount").replace(",", ".")) * 100);
    if (interval === "year" && fd.get("useSuggestion") === "1") {
      // Prix annuel calculé côté serveur : mensuel actif × 12, moins la remise de référence.
      const plans = await listPlans({ activeOnly: false });
      const monthly = plans.find((p) => p.plan.id === s(fd, "planId"))?.monthly;
      if (!monthly) throw new DomainError("invalid", "Définissez d'abord le prix mensuel.");
      amountCents = suggestedAnnualCents(monthly.amountCents, (await getSettings(true)).billing.annualDiscountPercent);
    }
    await admin.setPlanPrice(st, s(fd, "planId"), {
      interval,
      amountCents,
      taxBehavior: s(fd, "taxBehavior") === "inclusive" ? "inclusive" : "exclusive",
      stripePriceId: s(fd, "stripePriceId").trim() || null,
      isDemo: fd.get("isDemo") === "on",
    });
    return "Nouveau prix enregistré (les abonnements existants ne sont pas modifiés).";
  });
}

export async function updateOfferAction(fd: FormData) {
  await act("/admin/plans", "platform.plans.manage", async (st) => {
    await admin.updateServiceOffer(st, s(fd, "id"), {
      name: s(fd, "name"), description: s(fd, "description"), amountCents: Math.round(Number(s(fd, "amount").replace(",", ".")) * 100),
      includedRevisions: n(fd, "includedRevisions"), targetDays: n(fd, "targetDays") || null, stripePriceId: s(fd, "stripePriceId").trim() || null,
      isActive: fd.get("isActive") === "on", isDemo: fd.get("isDemo") === "on",
    });
    return "Prestation enregistrée.";
  });
}

export async function orderStatusAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/prestations/${id}`, "platform.service.manage", async (st) => {
    await orders.staffSetOrderStatus(st, id, s(fd, "status"));
    return "Statut mis à jour ; le client est notifié.";
  });
}

export async function orderDraftAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/prestations/${id}`, "platform.service.manage", async (st) => {
    await orders.staffCreateDraftForOrder(st, id);
    return "Brouillon créé dans l'organisation du client (accès d'assistance dédié, journalisé).";
  });
}

export async function orderMessageAdminAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/prestations/${id}`, "platform.service.manage", async (st) => {
    await orders.staffAddOrderMessage(st, id, s(fd, "body"));
    return "Message envoyé.";
  });
}

export async function ticketReplyAction(fd: FormData) {
  const id = s(fd, "id");
  await act(`/admin/support/${id}`, "platform.support.respond", async (st) => {
    await support.staffReply(st, id, s(fd, "body"), fd.get("close") === "on");
    return "Réponse envoyée.";
  });
}

"use server";

import { redirect } from "next/navigation";
import { requireStaffAction } from "@/lib/context";
import { DomainError } from "@/lib/errors";
import { createPromoCode, setPromoActive } from "@/lib/billing/promos";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(s(fd, k).replace(",", "."));

export async function createPromoAction(fd: FormData) {
  let target = "/admin/promotions";
  try {
    const staff = await requireStaffAction("platform.plans.manage");
    const kind = s(fd, "kind") === "amount" ? "amount" : "percent";
    await createPromoCode(staff, {
      code: s(fd, "code"),
      description: s(fd, "description"),
      kind,
      percentOff: kind === "percent" ? Math.round(num(fd, "percentOff")) : undefined,
      amountOffCents: kind === "amount" ? Math.round(num(fd, "amountOff") * 100) : undefined,
      duration: (["once", "forever", "repeating"].includes(s(fd, "duration")) ? s(fd, "duration") : "once") as "once" | "forever" | "repeating",
      durationMonths: Math.round(num(fd, "durationMonths")) || undefined,
      maxRedemptions: s(fd, "maxRedemptions") ? Math.round(num(fd, "maxRedemptions")) : null,
      expiresAt: s(fd, "expiresAt") || null,
    });
    target += "?ok=" + encodeURIComponent("Code promo créé.");
  } catch (e) {
    if (!(e instanceof DomainError)) console.error("[promotions]", e);
    target += "?erreur=" + encodeURIComponent(e instanceof DomainError ? e.message : "Création refusée.");
  }
  redirect(target);
}

export async function togglePromoAction(id: string, active: boolean) {
  let target = "/admin/promotions";
  try {
    const staff = await requireStaffAction("platform.plans.manage");
    await setPromoActive(staff, id, active);
    target += "?ok=" + encodeURIComponent(active ? "Code réactivé." : "Code désactivé.");
  } catch (e) {
    target += "?erreur=" + encodeURIComponent(e instanceof DomainError ? e.message : "Action refusée.");
  }
  redirect(target);
}

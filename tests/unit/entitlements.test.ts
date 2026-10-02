import { describe, expect, it } from "vitest";
import { deriveEntitlement, type SubscriptionSnapshot } from "@/lib/billing/entitlements";

const trialQuotas = { cards: 3, storageMb: 100, members: 3 };
const now = new Date("2026-10-02T12:00:00Z");
const day = 86400_000;
const sub = (p: Partial<SubscriptionSnapshot>): SubscriptionSnapshot => ({
  status: "active", currentPeriodEnd: new Date(now.getTime() + 20 * day), cancelAtPeriodEnd: false, cancelAt: null, endedAt: null, pastDueSince: null,
  quotas: { cards: 10, storageMb: 1000, members: 10 }, planName: "Équipe", ...p,
});
const base = { trialStartedAt: null, trialEndsAt: null, adminSuspendedAt: null, subscriptions: [], trialQuotas, graceDays: 7 };

describe("machine d'état des droits", () => {
  it("essai actif puis expiré au bout de 7 × 24 h exactement", () => {
    const start = new Date(now.getTime() - 7 * day + 1000);
    const input = { ...base, trialStartedAt: start, trialEndsAt: new Date(start.getTime() + 7 * day) };
    expect(deriveEntitlement(input, now).state).toBe("trial_active");
    const later = new Date(start.getTime() + 7 * day);
    const ent = deriveEntitlement(input, later);
    expect(ent.state).toBe("trial_expired");
    expect(ent.publicAccess).toBe(false);
    expect(ent.canEdit).toBe(true); // compte toujours accessible
  });

  it("abonnement actif avec quotas du plan", () => {
    const ent = deriveEntitlement({ ...base, subscriptions: [sub({})] }, now);
    expect(ent).toMatchObject({ state: "active", publicAccess: true, quotas: { cards: 10 } });
  });

  it("résiliation programmée : actif jusqu'à l'échéance, puis fin de droit même sans webhook", () => {
    const end = new Date(now.getTime() + 2 * day);
    const s = sub({ cancelAtPeriodEnd: true, currentPeriodEnd: end });
    expect(deriveEntitlement({ ...base, subscriptions: [s] }, now).state).toBe("cancel_scheduled");
    const after = deriveEntitlement({ ...base, subscriptions: [s] }, new Date(end.getTime() + 1));
    expect(after.state).toBe("ended");
    expect(after.publicAccess).toBe(false);
  });

  it("impayé : grâce puis suspension, distinct de la résiliation", () => {
    const s = sub({ status: "past_due", pastDueSince: new Date(now.getTime() - 3 * day) });
    expect(deriveEntitlement({ ...base, subscriptions: [s] }, now)).toMatchObject({ state: "past_due_grace", publicAccess: true });
    const s2 = sub({ status: "past_due", pastDueSince: new Date(now.getTime() - 8 * day) });
    expect(deriveEntitlement({ ...base, subscriptions: [s2] }, now)).toMatchObject({ state: "payment_suspended", publicAccess: false });
    expect(deriveEntitlement({ ...base, subscriptions: [sub({ status: "unpaid" })] }, now).state).toBe("payment_suspended");
  });

  it("premier paiement incomplet n'accorde rien", () => {
    const ent = deriveEntitlement({ ...base, subscriptions: [sub({ status: "incomplete" })] }, now);
    expect(ent.publicAccess).toBe(false);
  });

  it("la suspension administrative prime sur tout", () => {
    const ent = deriveEntitlement({ ...base, adminSuspendedAt: now, subscriptions: [sub({})] }, now);
    expect(ent).toMatchObject({ state: "admin_suspended", publicAccess: false, canEdit: false });
  });

  it("choisit l'abonnement le plus favorable dans l'historique", () => {
    const ent = deriveEntitlement({ ...base, subscriptions: [sub({ status: "canceled", endedAt: new Date(now.getTime() - day) }), sub({})] }, now);
    expect(ent.state).toBe("active");
  });
});

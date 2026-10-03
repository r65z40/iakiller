/**
 * Machine d'état des droits d'une organisation.
 *
 * Fonction PURE : les droits sont recalculés à chaque requête à partir de l'état en
 * base (lui-même synchronisé depuis Stripe) et de l'heure courante. Ainsi un essai ou
 * une période payée expire même si aucune tâche planifiée n'a tourné et même sans
 * visite du client : chaque lecture publique appelle cette fonction.
 */

export type EntitlementState =
  | "no_trial" //            essai non démarré (email non vérifié ou organisation non créée)
  | "trial_active"
  | "trial_expired"
  | "active"
  | "cancel_scheduled" //    résiliation programmée, actif jusqu'à l'échéance
  | "past_due_grace" //      paiement échoué, délai de grâce en cours
  | "payment_suspended" //   impayé au-delà du délai de grâce
  | "ended" //               fin de droit (résiliation effective, abonnement expiré)
  | "admin_suspended"; //    suspension administrative

export interface SubscriptionSnapshot {
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
  endedAt: Date | null;
  pastDueSince: Date | null;
  quotas: { cards: number; storageMb: number; members: number } | null;
  planName: string | null;
}

export interface EntitlementInput {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  adminSuspendedAt: Date | null;
  subscriptions: SubscriptionSnapshot[];
  trialQuotas: { cards: number; storageMb: number; members: number };
  graceDays: number;
}

export interface Entitlement {
  state: EntitlementState;
  /** Les cartes publiées sont-elles accessibles publiquement ? */
  publicAccess: boolean;
  /** Peut-on publier de nouvelles versions ? */
  canPublish: boolean;
  /** Peut-on modifier les brouillons ? (le compte reste accessible pour réactiver) */
  canEdit: boolean;
  quotas: { cards: number; storageMb: number; members: number };
  /** Échéance utile à afficher (fin d'essai, fin de période, fin de grâce). */
  until: Date | null;
  planName: string | null;
  source: "trial" | "subscription" | "none";
}

const DAY_MS = 24 * 60 * 60 * 1000;

type SubEval = { state: EntitlementState; until: Date | null; grants: boolean };

export function evaluateSubscription(sub: SubscriptionSnapshot, now: Date, graceDays: number): SubEval {
  const periodEnd = sub.currentPeriodEnd;
  const effectiveCancel = sub.cancelAt ?? (sub.cancelAtPeriodEnd ? periodEnd : null);
  switch (sub.status) {
    case "active":
    case "trialing": {
      if (sub.endedAt && sub.endedAt <= now) return { state: "ended", until: sub.endedAt, grants: false };
      if (effectiveCancel) {
        // La date de fin est appliquée côté serveur même si le webhook de fin n'est pas arrivé.
        if (effectiveCancel <= now) return { state: "ended", until: effectiveCancel, grants: false };
        return { state: "cancel_scheduled", until: effectiveCancel, grants: true };
      }
      return { state: "active", until: periodEnd, grants: true };
    }
    case "past_due": {
      const since = sub.pastDueSince ?? periodEnd ?? now;
      const graceEnd = new Date(since.getTime() + graceDays * DAY_MS);
      if (now < graceEnd) return { state: "past_due_grace", until: graceEnd, grants: true };
      return { state: "payment_suspended", until: graceEnd, grants: false };
    }
    case "unpaid":
      return { state: "payment_suspended", until: null, grants: false };
    case "paused":
      return { state: "payment_suspended", until: null, grants: false };
    case "canceled":
    case "incomplete_expired":
      return { state: "ended", until: sub.endedAt ?? periodEnd, grants: false };
    case "incomplete":
    default:
      // Premier paiement non confirmé : n'accorde rien.
      return { state: "no_trial", until: null, grants: false };
  }
}

const PRIORITY: EntitlementState[] = [
  "active",
  "cancel_scheduled",
  "past_due_grace",
  "payment_suspended",
  "ended",
  "no_trial",
];

export function deriveEntitlement(input: EntitlementInput, now: Date = new Date()): Entitlement {
  const base = { planName: null as string | null };

  if (input.adminSuspendedAt) {
    return {
      ...base,
      state: "admin_suspended",
      publicAccess: false,
      canPublish: false,
      canEdit: false,
      quotas: input.trialQuotas,
      until: null,
      source: "none",
    };
  }

  // Meilleur abonnement de l'organisation (en cas d'historique multiple).
  let best: { sub: SubscriptionSnapshot; ev: SubEval } | null = null;
  for (const sub of input.subscriptions) {
    const ev = evaluateSubscription(sub, now, input.graceDays);
    if (!best || PRIORITY.indexOf(ev.state) < PRIORITY.indexOf(best.ev.state)) best = { sub, ev };
  }

  if (best && best.ev.grants) {
    return {
      state: best.ev.state,
      publicAccess: true,
      canPublish: true,
      canEdit: true,
      quotas: best.sub.quotas ?? input.trialQuotas,
      until: best.ev.until,
      planName: best.sub.planName,
      source: "subscription",
    };
  }

  // Essai en cours ?
  if (input.trialStartedAt && input.trialEndsAt && now < input.trialEndsAt) {
    return {
      ...base,
      state: "trial_active",
      publicAccess: true,
      canPublish: true,
      canEdit: true,
      quotas: input.trialQuotas,
      until: input.trialEndsAt,
      source: "trial",
    };
  }

  // Aucun droit actif : le compte reste accessible pour consulter et payer.
  const fallbackState: EntitlementState =
    best && best.ev.state !== "no_trial" ? best.ev.state : input.trialStartedAt ? "trial_expired" : "no_trial";
  return {
    ...base,
    state: fallbackState,
    publicAccess: false,
    canPublish: false,
    canEdit: true,
    quotas: best?.sub.quotas ?? input.trialQuotas,
    until: best?.ev.until ?? input.trialEndsAt,
    planName: best?.sub.planName ?? null,
    source: "none",
  };
}

export const STATE_LABELS: Record<EntitlementState, string> = {
  no_trial: "Essai non démarré",
  trial_active: "Essai gratuit en cours",
  trial_expired: "Essai terminé",
  active: "Abonnement actif",
  cancel_scheduled: "Résiliation programmée",
  past_due_grace: "Paiement en échec – délai de grâce",
  payment_suspended: "Suspendu pour impayé",
  ended: "Abonnement terminé",
  admin_suspended: "Suspendu par la plateforme",
};

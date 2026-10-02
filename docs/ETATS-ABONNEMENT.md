# Machine d'état des droits

Fonction pure : `deriveEntitlement()` dans `src/lib/billing/entitlements.ts`. Elle est recalculée **à chaque requête** à partir de l'état en base (organisation et abonnements synchronisés depuis Stripe) et de l'heure courante. Aucune tâche planifiée n'est nécessaire pour qu'un droit expire.

| État | Condition | Public | Publier | Éditer |
|---|---|:-:|:-:|:-:|
| `admin_suspended` | organisation suspendue ou supprimée | ❌ | ❌ | ❌ |
| `active` | statut Stripe `active` ou `trialing`, sans résiliation | ✅ | ✅ | ✅ |
| `cancel_scheduled` | `cancel_at_period_end` ou `cancel_at` dans le futur | ✅ | ✅ | ✅ |
| `past_due_grace` | `past_due` et premier échec il y a moins de `BILLING_GRACE_DAYS` | ✅ | ✅ | ✅ |
| `payment_suspended` | `past_due` au-delà de la grâce, `unpaid`, `paused` | ❌ | ❌ | ✅ |
| `ended` | `canceled`, `incomplete_expired`, ou date de résiliation dépassée | ❌ | ❌ | ✅ |
| `trial_active` | aucun abonnement qui accorde un droit, essai en cours | ✅ | ✅ | ✅ |
| `trial_expired` | essai terminé, sans abonnement | ❌ | ❌ | ✅ |
| `no_trial` | essai non démarré ou premier paiement `incomplete` | ❌ | ❌ | ✅ |

Règles :
- Le meilleur abonnement de l'historique est retenu (active > cancel_scheduled > grâce > …).
- Un abonnement **résilié en fin de période** devient `ended` dès que l'échéance est passée, même si le webhook final n'est pas encore arrivé.
- Paiement échoué (`invoice.payment_failed`) ≠ impayé (`past_due`, `unpaid`) ≠ résiliation volontaire (`cancel_at_period_end`) : ce sont trois états et trois emails distincts.
- Les quotas proviennent du plan associé au prix Stripe de l'abonnement, sinon des quotas d'essai.
- Le paiement d'une prestation ponctuelle ne crée jamais d'abonnement.
- Réactivation : un nouvel abonnement (Checkout) ou une résiliation annulée rend les cartes publiques à nouveau, sans perte de contenu.

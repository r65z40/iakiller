# Stripe : configuration, scénarios de test, mise en production

## Configuration en mode test

1. Créer un compte Stripe et rester en **mode test**.
2. Créer un produit par plan, avec un prix récurrent mensuel et un prix annuel en EUR. Choisir explicitement le comportement fiscal (HT ou TTC) selon la décision prise avec l'expert-comptable.
3. Créer un produit « Création accompagnée » avec un prix ponctuel.
4. Dans `/admin/plans`, saisir pour chaque plan les montants (identiques à Stripe), la présentation HT/TTC et l'identifiant `price_…`, puis décocher « démonstration » une fois les valeurs validées.
5. Variables : `STRIPE_SECRET_KEY=sk_test_…`, puis lancer le relais des webhooks :
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   et copier le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
6. Portail client (Paramètres > Billing > Customer portal) : autoriser la mise à jour du moyen de paiement et l'historique des factures. **Désactiver le changement de formule** dans le portail : il se fait dans l'application, qui contrôle les quotas.
7. Événements à envoyer au webhook en production : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created|updated|deleted|paused|resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`.

## Scénarios de test manuels (à dérouler avant la production)

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Souscrire avec la carte de test `4242 4242 4242 4242` | Retour sur « paiement en cours de confirmation », puis état « Abonnement actif » à réception du webhook |
| 2 | Ouvrir `/app/abonnement?retour=paiement` sans payer | Aucun droit accordé |
| 3 | Rejouer un événement (`stripe events resend evt_…`) | Réponse `duplicate`, aucun changement |
| 4 | Envoyer une signature invalide (`curl` sans en-tête) | 400 |
| 5 | Carte de test refusée au renouvellement (`4000 0000 0000 0341` + horloge de test) | `past_due`, email d'échec, cartes accessibles pendant la grâce, puis suspendues |
| 6 | Résilier depuis l'application | « Résiliation programmée », cartes en ligne jusqu'à l'échéance ; avancer l'horloge de test : cartes indisponibles, compte accessible |
| 7 | Annuler la résiliation | Retour à « Abonnement actif » |
| 8 | Passer à une formule supérieure | Aperçu du montant, confirmation, facture de prorata |
| 9 | Passer à une formule inférieure avec trop de cartes | Refusé tant que des cartes ne sont pas archivées |
| 10 | Webhook coupé pendant un changement, puis `npm run jobs` | La réconciliation rattrape l'état |
| 11 | Payer une prestation | Commande « Brief reçu », aucun abonnement créé |
| 12 | Authentification 3-D Secure (`4000 0025 0000 3155`) | Abonnement actif seulement après confirmation |

## Liste de contrôle avant la production

- [ ] Prix réels créés en mode live, identiques à `/admin/plans`, marqueurs « démonstration » retirés
- [ ] Fiscalité (TVA, Stripe Tax ou non) validée et configurée
- [ ] Webhook live créé, `STRIPE_WEBHOOK_SECRET` live renseigné
- [ ] `STRIPE_SECRET_KEY=sk_live_…` **et** `STRIPE_ALLOW_LIVE=true`
- [ ] Portail client live configuré (sans changement de formule)
- [ ] Informations de la société renseignées (Stripe et `LEGAL_*`)
- [ ] `/admin` : plus aucun point « Lancement commercial bloqué »
- [ ] Un paiement réel de faible montant remboursé pour vérifier la chaîne de bout en bout (sur décision explicite de l'exploitant)

# Plan d'implémentation et état d'avancement

## Tranches

| Tranche | Contenu | État |
|---|---|---|
| A | Socle, inscription et vérification, organisations, permissions, carte éditable, publication, rendu public, vCard | ✅ livré |
| B | Éditeur par blocs, glisser-déposer accessible, brouillons et versions, médias, 3 modèles, marque verrouillable, QR stable | ✅ livré |
| C | Machine d'état des droits, quotas, Checkout, portail, changement de formule, webhooks idempotents, réconciliation, création accompagnée | ✅ livré (Stripe testé avec un faux client, voir « Limites ») |
| D | Membres et invitations, rôles, prospects, statistiques et export | ✅ livré |
| E | Administration, support, accès d'assistance, site commercial, pages légales à compléter, tâches planifiées, sauvegarde et restauration, E2E | ✅ livré |

## Réglages de la plateforme (ajout)

`/admin/reglages` : marque et domaine, société, tarification (délai de grâce, remise annuelle de référence, mention fiscale), conservation (purges automatiques), conditions de la création accompagnée, texte définitif et validation juridique des cinq pages légales, régime de mesure d'audience et sa validation. Réglages stockés dans `platform_setting`, validés par Zod, journalisés, avec les variables d'environnement comme valeurs par défaut. Tests : `tests/integration/settings.test.ts`.

## Améliorations (troisième lot)

| Fonction | Où | Tests |
|---|---|---|
| Un seul essai gratuit par utilisateur (résiste aux créations simultanées) | `orgs/service.ts` | `cards.test.ts` |
| Image d'aperçu générée pour le partage (Open Graph), neutre si la carte est indisponible | `[org]/[person]/opengraph-image.tsx` | vérifiée manuellement |
| Bloc « Avis clients » : liens uniquement, aucune saisie d'avis ni de note | `cards/document.ts`, `CardView` | `features.test.ts` |
| Éditeur : annuler et rétablir (Ctrl+Z, Ctrl+Maj+Z), aperçu téléphone et ordinateur, recadrage des images (nouvelle image, originale conservée) | `components/editor/*`, `/api/media/[id]/crop` | `features.test.ts` + navigateur |
| QR personnalisé (couleur, logo) avec vérification de contraste et décodage réel à deux tailles | `cards/qr.ts` | `features.test.ts` |
| Import CSV des cartes salariés (aperçu, quota, invitation et attribution à l'acceptation, publication facultative) | `cards/import.ts`, `/app/cartes/import` | `features.test.ts` |
| Apple Wallet (.pkpass) et Google Wallet (lien signé) | `lib/wallet/*`, `[org]/[person]/wallet/*`, `docs/WALLET.md` | `wallet.test.ts` (certificats factices) |

Limite : Apple Wallet et Google Wallet n'ont pas pu être essayés avec de vrais identifiants ni sur un vrai téléphone.

## Couverture des critères de validation

| # | Critère | Preuve |
|---|---|---|
| 1 | 3 cartes en essai, 4ᵉ et créations simultanées refusées | `tests/integration/cards.test.ts` (8 créations parallèles, 3 acceptées) ; E2E « quota d'essai » |
| 2 | Déplacement à la souris, au tactile et sans glisser-déposer | dnd-kit avec capteurs pointeur, tactile et clavier, plus boutons monter/descendre ; E2E « réordonnancement » (clavier et boutons) |
| 3 | Brouillon isolé de la version publiée ; reprise de l'enregistrement après erreur | test « un brouillon ne modifie pas la version publiée », E2E ; `useAutosave` : nouvelles tentatives progressives, reprise au retour du réseau, conflits de révision |
| 4 | Petits écrans, clavier, agrandissement du texte | E2E : largeur 360 px sans défilement horizontal ; focus visible, libellés, unités relatives |
| 5 | Fixe/mobile/vCard, liens, PDF, galerie, formulaire | tests unitaires vCard ; E2E publication + vCard ; E2E formulaire prospect |
| 6 | QR valide après renommage, indisponible après fin de droit | `cards.test.ts` (renommage, désactivation, expiration) |
| 7 | Expiration de l'essai sans visite ; contrôle sur toute lecture publique | `entitlements.test.ts` ; `cards.test.ts` « sans aucune tâche planifiée » (page, QR, médias, prospects, mesures) |
| 8 | Paiement confirmé → droits ; redirection falsifiée → aucun droit | `billing.test.ts` |
| 9 | Webhooks invalides, dupliqués, hors ordre | `billing.test.ts` |
| 10 | Résiliation : actif jusqu'à l'échéance puis inaccessible, compte conservé | `billing.test.ts` « résiliation » |
| 11 | Rétrogradation sans dépassement ni suppression | `billing.test.ts` « rétrogradation » |
| 12 | Isolation A/B (cartes, médias, prospects, statistiques) | `cards.test.ts`, `members-leads-analytics.test.ts` |
| 13 | Marque verrouillée, révocation immédiate | `media-brand.test.ts`, `members-leads-analytics.test.ts` |
| 14 | Mesure conforme au régime ; métriques non trompeuses | `members-leads-analytics.test.ts` (robots, visites internes, orphelins) ; définitions affichées |
| 15 | Prestation sans droit d'abonnement ; validation avant publication | `billing.test.ts` « création accompagnée » |
| 16 | Désactivation → caches et fichiers | médias servis uniquement pour une version publiée et accessible ; pages dynamiques ; cache de 5 minutes documenté |
| 17 | Fichiers excessifs, faux types, contenus actifs, URL dangereuses | `media-brand.test.ts`, `vcard-urls.test.ts`, `cards.test.ts` (javascript:) |
| 18 | Tests automatisés et E2E | 66 tests Vitest sur PostgreSQL réel, 5 parcours Playwright |

## Limites réelles

- **Stripe non testé contre l'API réelle** : aucune clé de test n'était disponible et le réseau vers Stripe était bloqué. La logique (webhooks, idempotence, relecture d'état) est testée avec des signatures réelles générées par le SDK et un faux client. Les appels `checkout.sessions.create`, `invoices.createPreview`, `subscriptions.update` et `billingPortal.sessions.create` sont écrits d'après les types du SDK, mais **n'ont jamais été exécutés** : il faut dérouler les scénarios de `docs/STRIPE.md` en mode test.
- **Emails** : le mode SMTP est écrit mais n'a pas été essayé avec un vrai serveur.
- **Stockage S3** : le pilote est écrit mais n'a pas été essayé avec un vrai bucket. Seul le disque local est testé.
- **Limiteur de débit** en mémoire : convient pour une seule instance.
- **Accès d'assistance** : le mode assistance de l'espace client est implémenté. Les pièces jointes des tickets ne sont visibles par l'équipe qu'en passant par ce mode.
- **Texte riche** : syntaxe légère (gras, italique, listes), pas d'éditeur WYSIWYG.
- **Statistiques au-delà de la conservation brute** : seuls les agrégats journaliers par type et par source restent ; les taux par ouverture ne sont plus calculables sur ces périodes et les tableaux de bord ne lisent pas encore ces agrégats.
- **Pays** : renseigné seulement si le proxy ou le CDN transmet un en-tête (`cf-ipcountry`, `x-vercel-ip-country`, `x-country-code`).
- **Pages légales** : ce sont des modèles à compléter et à faire valider ; elles ne valent pas conformité.
- **Accessibilité** : vérifiée par conception et par tests ciblés, sans audit RGAA complet.
- **Référence visuelle** : la page Cedelia n'était pas joignable depuis l'environnement ; le rendu s'appuie sur la capture fournie.

## Reprise conseillée

1. Configurer Stripe en mode test (`docs/STRIPE.md`) et dérouler les scénarios manuels.
2. Brancher un SMTP et un bucket de recette.
3. Valider les propositions de DECISIONS.md, renseigner les prix et les champs `LEGAL_*`, puis retirer les marqueurs de démonstration.
4. Faire relire les pages légales et le régime des statistiques.
5. Si plusieurs instances : partager le limiteur de débit et la planification des tâches.

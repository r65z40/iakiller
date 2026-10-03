# Décisions

Ce document sépare les **décisions confirmées** par le cahier des charges des **propositions** faites pendant le développement. Une proposition est un choix de départ réversible : elle reste à valider.

## 1. Décisions confirmées (cahier des charges)

| Sujet | Décision |
|---|---|
| Langue | Interface entièrement en français. |
| Exploitant | Société existante ; informations juridiques à fournir (champs `LEGAL_*`). |
| Création | Éditeur en libre-service, ou prestation payante de création par l'équipe. |
| Essai | Gratuit, 7 jours, jusqu'à 3 cartes. |
| Abonnements | Mensuels et annuels ; l'annuel revient moins cher par mois (contrôle bloquant au lancement). |
| Entreprise | Formule à plusieurs collaborateurs, gestion centralisée. |
| Adresses publiques | `https://DOMAINE/entreprise/personne`, sans domaine personnalisé pour les clients. |
| Fonctions | Personnalisation étendue, glisser-déposer, statistiques détaillées, prospects, administration. |
| Résiliation | Cartes inaccessibles à la fin de la période payée ; pas de maintien gratuit. |
| Périmètre | Cartes numériques uniquement : ni carte physique, ni NFC, ni boutique ; QR code PNG et SVG obligatoire. |
| Non fixés | Nom de marque, domaine, prix, budget, hébergeurs. |
| Visuel | Carte Cedelia comme référence de finition, bleu `#0047BB` par défaut ; données de démonstration fictives. |

## 2. Propositions techniques (réversibles)

| Proposition | Justification | Pour revenir dessus |
|---|---|---|
| Next.js 16 (App Router) + TypeScript | Un seul projet pour le site, l'espace client, l'administration et l'API ; rendu serveur des cartes. | Architecture détaillée dans ARCHITECTURE.md. |
| PostgreSQL 16 + Drizzle ORM 0.45 | Base relationnelle, transactions avec `SELECT … FOR UPDATE` pour les quotas, migrations SQL versionnées. | Le schéma est dans `src/lib/db/schema.ts`. |
| Better Auth 1.7 | Bibliothèque d'authentification éprouvée : email vérifié, réinitialisation, TOTP, sessions en base, limitation de débit. | `src/lib/auth.ts`. |
| Stripe Checkout + Billing + Customer Portal | Proposition du cahier des charges, conservée. Le paiement est hébergé et aucun numéro de carte ne transite par l'application. | `src/lib/billing/*`. |
| Stockage local ou compatible S3, bucket privé | Fichiers toujours servis par l'application après contrôle d'accès. | `STORAGE_DRIVER`. |
| Polices auto-hébergées (@fontsource) | Pas d'appel à Google Fonts depuis les pages publiques, donc aucune transmission d'adresse IP à un tiers. | `src/app/globals.css`. |
| Changement de formule dans l'application | Permet d'imposer le choix des cartes à archiver avant une rétrogradation. Le portail Stripe sert au moyen de paiement et aux factures. | Désactivez le changement de formule dans la configuration du portail Stripe. |

## 3. Propositions métier À VALIDER

| # | Proposition | Valeur par défaut | Où la modifier |
|---|---|---|---|
| P1 | Essai sans carte bancaire, démarré à la **création de l'organisation**. L'email doit être vérifié au préalable, car la connexion l'exige. | — | `src/lib/orgs/service.ts` |
| P2 | **Confirmé** : un seul essai par utilisateur. Une organisation supplémentaire démarre sans essai (création possible, publication soumise à une formule). Limite connue : une personne peut créer un nouveau compte avec une autre adresse email. | 1 essai par compte | `src/lib/orgs/service.ts` |
| P3 | Expiration au bout de 7 × 24 h exactement. Horodatages en UTC, affichage en Europe/Paris. | 168 h | `trialRules` dans `src/lib/config.ts` |
| P4 | Pendant l'essai : 3 cartes non archivées (brouillons inclus), 100 Mo, 3 membres. | 3 / 100 Mo / 3 | `trialRules` |
| P5 | Après l'essai ou la fin de droit : cartes, QR et médias indisponibles ; compte, édition et paiement conservés ; aucune suppression automatique. | — | `entitlements.ts` |
| P6 | Délai de grâce en cas d'impayé. | 7 jours | `BILLING_GRACE_DAYS` |
| P7 | Plans « Individuel », « Équipe », « Entreprise » avec quotas et prix **de démonstration** (vente bloquée tant qu'ils sont marqués démo). | 1, 10 et 50 cartes ; 9, 29 et 99 €/mois ; 90, 290 et 990 €/an HT | `/admin/plans` |
| P8 | Prorata : changement immédiat, facturation immédiate de la différence (`always_invoice`). | — | `billing/service.ts` |
| P9 | Rétrogradation sous le nombre de cartes : refusée tant que le client n'a pas archivé lui-même les cartes en trop. | — | `changePlan` |
| P10 | Un collaborateur peut **publier** les cartes qui lui sont assignées. | autorisé | `publishCard` |
| P11 | Un gestionnaire peut retirer des collaborateurs, mais pas d'autres gestionnaires. | — | `members.ts` |
| P12 | Les verrous de marque s'appliquent aussi au rendu des cartes déjà publiées, donc immédiatement. | — | `public.ts` |
| P13 | Indexation des cartes désactivée par défaut, activable par le propriétaire. | désactivée | Paramètres |
| P14 | Mesure d'audience « minimale » : pas de cookie, pas d'identifiant persistant, pas d'IP stockée. Le mode consentement préalable est disponible. **Le régime par défaut doit être validé juridiquement.** | minimal, sans consentement | `ANALYTICS_*` |
| P15 | Conservation des événements bruts 395 jours, puis agrégats journaliers. | 395 j | `ANALYTICS_RAW_RETENTION_DAYS` |
| P16 | Prestation « Création de carte » : 149 € (démo), 2 séries de corrections, délai interne de 5 jours **non affiché publiquement**. | démo | `/admin/plans` |
| P17 | Accès d'assistance : 24 h maximum, motif obligatoire, propriétaire notifié par email et pouvant le révoquer. Pas d'approbation préalable du client. | — | `support/service.ts` |
| P18 | Accès lié à une création accompagnée : 30 jours, révoqué à la validation, à la clôture ou à l'annulation. | 30 j | `orders.ts` |
| P19 | Remboursements de prestation : demande enregistrée, traitement **manuel** dans Stripe, sans automatisation. | — | — |
| P20 | Invitations valables 7 jours, réservées à l'adresse invitée. | 7 j | `members.ts` |
| P21 | Formulaire prospect : au moins un email ou un téléphone ; limite de 5 envois par connexion toutes les 10 minutes et de 100 par carte et par jour ; déduplication sur 24 h. | — | `leads/service.ts` |
| P22 | Médias : images ré-encodées en WebP de 1 600 px maximum et 8 Mo en entrée, PDF de 15 Mo maximum ; SVG refusé. | — | `config.ts` |
| P23 | Cache navigateur des médias publics : 5 minutes, sans cache partagé (CDN). La désactivation prend donc effet au plus tard 5 minutes après pour un navigateur ayant déjà chargé le fichier. | 300 s | `media/respond.ts` |

## 4. Décisions à prendre avant le lancement commercial

Toutes ces décisions se saisissent dans **`/admin/reglages`** (administrateur avec double authentification), sans redéploiement. Chaque modification est journalisée. Tant qu'un point manque, il apparaît dans la liste « avant le lancement » de l'administration.

| Décision | Où la saisir |
|---|---|
| Nom de marque, accroche, domaine public, emails | Réglages > Marque et domaine |
| Informations de la société | Réglages > Société |
| Délai de grâce, remise annuelle de référence, mention fiscale | Réglages > Tarification et impayés |
| Prix réels par plan | Plans et prestations (suggestion du prix annuel à partir de la remise) |
| Durées de conservation (purges automatiques) | Réglages > Conservation des données |
| Conditions de la création accompagnée | Réglages > Création accompagnée (et prix, corrections par prestation dans Plans et prestations) |
| Validation juridique de chaque page légale (texte définitif facultatif) | Réglages > pages légales |
| Régime de mesure d'audience et sa validation | Réglages > Mesure d'audience |


1. **Marque et domaine** : nom définitif (`NEXT_PUBLIC_BRAND_NAME`), domaine et adresses email.
2. **Informations de la société** : raison sociale, forme, capital, siège, SIREN/RCS, TVA, directeur ou directrice de la publication, hébergeur.
3. **Prix et quotas** réels par plan, remise annuelle, présentation HT ou TTC, régime de TVA (validation par l'expert-comptable).
4. **Politique d'impayé** : durée de grâce et relances.
5. **Conservation des données** : comptes après résiliation, prospects, journaux, statistiques, pièces comptables. Aucune durée juridique n'a été inventée.
6. **Prestation accompagnée** : prix, nombre de corrections, délais, conditions de remboursement.
7. **Régime des statistiques** au regard des recommandations de la CNIL (consentement ou exemption).
8. **Fournisseurs et budget** : hébergement, base gérée, stockage, emails (voir ARCHITECTURE.md, section Coûts).
9. **Conditions générales, politique de confidentialité, accord de sous-traitance** : relecture par un professionnel.

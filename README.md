# MaCartePro — cartes de visite numériques

SaaS de cartes de visite numériques pour artisans, indépendants, commerciaux, TPE et PME : éditeur par blocs, page publique mobile `/{entreprise}/{personne}`, QR code stable, vCard, formulaire de prospects, statistiques expliquées, équipes, abonnements Stripe, création accompagnée, administration.

**Guides** : [Installation](docs/INSTALLATION.md) · [Fonctionnalités](docs/FONCTIONNALITES.md) · [Sauvegardes](docs/SAUVEGARDE.md) · [Audit de sécurité](docs/AUDIT-SECURITE.md)

Documents : [PRODUCT_SPEC](PRODUCT_SPEC.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DECISIONS](DECISIONS.md) · [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) · [Permissions](docs/PERMISSIONS.md) · [États d'abonnement](docs/ETATS-ABONNEMENT.md) · [Statistiques](docs/STATISTIQUES.md) · [Stripe](docs/STRIPE.md) · [Exploitation](docs/EXPLOITATION.md)

## Prérequis

- Node.js 22 (20.9 minimum)
- PostgreSQL 16

## Installation en une commande

```bash
git clone <adresse du dépôt> macartepro && cd macartepro
chmod +x install.sh
./install.sh          # interactif : dépendances, secrets, base, migrations, données de départ
npm run dev           # http://localhost:3000
```

- `./install.sh --yes` : installe sans poser de question (valeurs locales par défaut).
- `npm run setup` : configuration guidée seule, si les dépendances sont déjà installées.
- `npm run doctor` : vérifie la configuration à tout moment.

**Guide pas à pas, chaque commande détaillée (pour débuter) et mise en production** :
[docs/INSTALLATION.md](docs/INSTALLATION.md).

### Comptes de test

| Compte | Accès |
|---|---|
| `demo@exemple.test` / `demo-carte-2026` | organisation fictive « Atelier Exemple (démo) » avec 3 cartes publiées (essai de 7 jours à partir du seed) |
| Administrateur | s'inscrire, confirmer l'email (lien sur `/dev/emails`), puis `npm run admin:create -- --email vous@exemple.test` et activer la double authentification dans `/admin/securite` |

### Emails en développement

`EMAIL_MODE=log` : aucun email n'est envoyé. Ils sont affichés dans la console et consultables sur **http://localhost:3000/dev/emails** (liens de confirmation, invitations, rappels). Ce mode est désactivé en production.

### Paiement en développement

Sans `STRIPE_SECRET_KEY`, l'application est en **mode local** : les écrans de facturation l'indiquent, la souscription est désactivée et **aucun paiement n'est simulé comme réussi**. Pour tester avec Stripe en mode test, suivre [docs/STRIPE.md](docs/STRIPE.md) :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Stockage

`STORAGE_DRIVER=local` : fichiers dans `./storage`. En recette ou en production, `STORAGE_DRIVER=s3` avec un bucket **privé** compatible S3 (`S3_*`).

### Tâches planifiées

```bash
npm run jobs             # une exécution (cron toutes les 15 min)
npm run jobs -- --watch  # boucle continue
```

## Sauvegardes

Base de données et fichiers, chiffrés, incrémentaux, vérifiés, avec essai de restauration automatique et alertes : `/admin/sauvegardes` et `npm run backup`. Voir [docs/SAUVEGARDE.md](docs/SAUVEGARDE.md).

## Signature email

Depuis une carte (`/app/cartes/{id}/signature`), générez une signature d'email aux couleurs de la carte (trois styles, logo en bannière, mini QR code), avec copie en un clic et ouverture directe des réglages Gmail. Voir [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md).

## Apple Wallet et Google Wallet

Facultatifs : configurez les variables `APPLE_WALLET_*` et `GOOGLE_WALLET_*` (procédure dans [docs/WALLET.md](docs/WALLET.md)). Sans elles, les boutons sont masqués.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test                 # 117 tests unitaires et d'intégration (base cartes_test requise)
npm run test:e2e         # 6 parcours Playwright (base cartes_e2e requise)
npm run build
```

Bases de test : `createdb -O cartes cartes_test && createdb -O cartes cartes_e2e`, puis migrations avec `DATABASE_URL=… npm run db:migrate` pour chacune. Si Chromium est déjà installé ailleurs : `PLAYWRIGHT_CHROMIUM_PATH=/chemin/chromium npm run test:e2e`.

## Déploiement, sauvegarde, restauration

Voir [docs/INSTALLATION.md](docs/INSTALLATION.md) (serveur, services systemd et HTTPS fournis dans `deploy/`), [docs/EXPLOITATION.md](docs/EXPLOITATION.md) et [docs/SAUVEGARDE.md](docs/SAUVEGARDE.md).

## Réglages de la plateforme (administration)

`/admin/reglages` permet de personnaliser sans redéploiement : marque et domaine, informations de la société, délai de grâce, remise annuelle de référence et mention fiscale, durées de conservation (avec purges automatiques), conditions de la création accompagnée, texte définitif et validation juridique de chaque page légale, régime de mesure d'audience et sa validation. Les prix réels se saisissent dans `/admin/plans`. Les variables d'environnement servent de valeurs par défaut ; les secrets restent hors de l'interface.

Changer de domaine : faire pointer le DNS et le certificat vers le serveur, conserver une redirection depuis l'ancien domaine (QR déjà imprimés), redémarrer l'application, puis mettre `APP_URL` à jour au déploiement suivant.

## Avant la mise en production : paramètres à renseigner

1. **Marque, domaine et société** : dans `/admin/reglages` (ou, par défaut, `NEXT_PUBLIC_BRAND_NAME`, `APP_URL`, `SUPPORT_EMAIL`, `EMAIL_FROM`, `LEGAL_*`).
2. **URL technique** : `APP_URL` en HTTPS.
3. **Secrets** : `BETTER_AUTH_SECRET`, `DATABASE_URL`, `SMTP_URL`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
4. **Paiement live** : `STRIPE_ALLOW_LIVE=true` (garde-fou volontaire), prix live associés dans `/admin/plans`, marqueurs « démonstration » retirés.
5. **Règles** : délai de grâce, conservation, régime de mesure, dans `/admin/reglages`.
6. **Validation juridique** : à enregistrer page par page dans `/admin/reglages` après relecture par un professionnel.
7. **Décisions** listées dans [DECISIONS.md](DECISIONS.md), section 4.

Le tableau de bord `/admin` affiche en permanence les points qui bloquent encore le lancement commercial.

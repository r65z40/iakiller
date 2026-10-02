# Cartes de visite numériques (nom provisoire : Carto)

SaaS de cartes de visite numériques pour artisans, indépendants, commerciaux, TPE et PME : éditeur par blocs, page publique mobile `/{entreprise}/{personne}`, QR code stable, vCard, formulaire de prospects, statistiques expliquées, équipes, abonnements Stripe, création accompagnée, administration.

Documents : [PRODUCT_SPEC](PRODUCT_SPEC.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DECISIONS](DECISIONS.md) · [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) · [Permissions](docs/PERMISSIONS.md) · [États d'abonnement](docs/ETATS-ABONNEMENT.md) · [Statistiques](docs/STATISTIQUES.md) · [Stripe](docs/STRIPE.md) · [Exploitation](docs/EXPLOITATION.md)

## Prérequis

- Node.js 22 (20.9 minimum)
- PostgreSQL 16

## Installation locale

```bash
npm install
cp .env.example .env
# Renseigner au minimum DATABASE_URL et BETTER_AUTH_SECRET (openssl rand -base64 48)

# Base de données (exemple)
sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD 'cartes' CREATEDB;"
sudo -u postgres createdb -O cartes cartes_dev

npm run db:migrate      # applique les migrations
npm run db:seed         # plans et prestation de démonstration, compte fictif
npm run dev             # http://localhost:3000
```

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

## Vérifications

```bash
npm run typecheck
npm run lint
npm test                 # 66 tests unitaires et d'intégration (base cartes_test requise)
npm run test:e2e         # 5 parcours Playwright (base cartes_e2e requise)
npm run build
```

Bases de test : `createdb -O cartes cartes_test && createdb -O cartes cartes_e2e`, puis migrations avec `DATABASE_URL=… npm run db:migrate` pour chacune. Si Chromium est déjà installé ailleurs : `PLAYWRIGHT_CHROMIUM_PATH=/chemin/chromium npm run test:e2e`.

## Déploiement, sauvegarde, restauration

Voir [docs/EXPLOITATION.md](docs/EXPLOITATION.md) : une instance Node.js derrière HTTPS, PostgreSQL géré, bucket S3 privé, SMTP, `npm run jobs` planifié, scripts `scripts/ops/backup.sh` et `scripts/ops/restore.sh` (restauration testée).

## Avant la mise en production : paramètres à renseigner

1. **Marque et domaine** : `NEXT_PUBLIC_BRAND_NAME`, `APP_URL` (HTTPS), `SUPPORT_EMAIL`, `EMAIL_FROM`.
2. **Société** : `LEGAL_COMPANY_NAME`, `LEGAL_FORM`, `LEGAL_CAPITAL`, `LEGAL_ADDRESS`, `LEGAL_SIREN`, `LEGAL_VAT`, `LEGAL_DIRECTOR`, `LEGAL_HOST`, `LEGAL_CONTACT_EMAIL`.
3. **Secrets** : `BETTER_AUTH_SECRET`, `DATABASE_URL`, `SMTP_URL`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
4. **Paiement live** : `STRIPE_ALLOW_LIVE=true` (garde-fou volontaire), prix live associés dans `/admin/plans`, marqueurs « démonstration » retirés.
5. **Règles** : `BILLING_GRACE_DAYS`, `ANALYTICS_MODE`, `ANALYTICS_REQUIRE_CONSENT`, `ANALYTICS_RAW_RETENTION_DAYS`.
6. **Validation juridique** : conditions, confidentialité, cookies, accord de sous-traitance, régime des statistiques.
7. **Décisions** listées dans [DECISIONS.md](DECISIONS.md), section 4.

Le tableau de bord `/admin` affiche en permanence les points qui bloquent encore le lancement commercial.

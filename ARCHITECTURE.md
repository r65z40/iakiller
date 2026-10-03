# Architecture

## Vue d'ensemble

Une seule application web, un monolithe modulaire, sans microservices ni Kubernetes :

```
Navigateur ──► Next.js 16 (Node.js)
                 ├─ site commercial, espace client /app, administration /admin
                 ├─ pages publiques /{org}/{personne}, /r/{jeton}, /m/{média}
                 ├─ API : /api/auth (Better Auth), /api/stripe/webhook, /api/public/*, /api/media
                 └─ actions serveur (mutations de l'espace client et de l'administration)
             ──► PostgreSQL 16 (données métier, sessions, files d'emails, journaux)
             ──► Stockage d'objets compatible S3, bucket privé (ou disque local)
             ──► Stripe (Checkout, Billing, Customer Portal, webhooks)
             ──► SMTP (emails transactionnels)
             ──► Destination de sauvegarde (bucket S3 dédié ou dossier), chiffrée
Tâches planifiées : `npm run jobs` toutes les 15 minutes (cron ou boucle `--watch`).
```

## Versions et vérification des documentations

Versions installées et vérifiées sur le registre npm le 2 octobre 2026 : Next.js 16.3.8, React 19.3, Drizzle ORM 0.45.3 (dernière stable), drizzle-kit 0.31, Better Auth 1.7.7, Stripe Node 23.0.0 (API `2026-09-30.endive`), Zod 4, Tailwind CSS 4, Vitest 5, Playwright 1.63.

L'environnement de développement **n'avait pas accès** aux sites de documentation (docs.stripe.com, nextjs.org, cnil.fr, better-auth.com : bloqués par le proxy réseau). Les API ont donc été vérifiées dans la documentation et les définitions de types **embarquées dans les paquets** :
- Next.js : `node_modules/next/dist/docs` (guide de mise à niveau vers la version 16 : `params` asynchrones, `proxy` à la place de `middleware`, nouvelles valeurs par défaut de `next/image`).
- Stripe : types de l'API `2026-09-30` (`current_period_end` porté par l'élément d'abonnement, `invoices.createPreview`, `invoice.parent.subscription_details`).
- Better Auth : schéma des tables et options de `emailAndPassword`, `emailVerification`, `twoFactor` et `rateLimit`.

**À faire avant la production** : relire les pages officielles Stripe (webhooks d'abonnement, objet Subscription, configuration du portail) et les recommandations CNIL sur la mesure d'audience, puis comparer avec `src/lib/billing/*` et `docs/STATISTIQUES.md`.

## Arborescence

```
src/
  app/                      routes (App Router)
    (site)/                 site commercial et pages légales
    (auth)/                 connexion, inscription, mot de passe
    app/                    espace client (+ _actions/ : actions serveur)
    admin/                  espace plateforme (+ _lib/actions.ts)
    [org]/[person]/         carte publique, vCard
    r/[token]/              redirection stable du QR code
    m/[id]/                 médias publics contrôlés
    api/                    auth, webhooks Stripe, mesures, prospects, envoi de médias
  components/               interface (card/CardView, editor/*, ui/*, billing/*, site/*)
  lib/
    db/schema.ts            schéma relationnel (source des migrations)
    cards/                  document versionné, service, rendu public, vCard, QR, slugs
    billing/                droits (machine d'état), Stripe, synchronisation, webhooks
    backup/                 sauvegardes : service, politique de rétention, chiffrement, pg_dump
    orgs/, leads/, analytics/, media/, services/, support/, admin/
    permissions.ts          matrice de permissions centralisée
    context.ts              session → utilisateur → appartenance → droits
drizzle/                    migrations SQL versionnées
scripts/                    migrate, seed, jobs, create-admin, backup, doctor, setup
deploy/                     services systemd (application, tâches), Caddyfile, nginx
tests/unit, tests/integration (Vitest + PostgreSQL réel), tests/e2e (Playwright)
```

## Principes de sécurité appliqués

- **Autorisation côté serveur** à chaque lecture et mutation. `getOrgContext()` relit l'appartenance en base. Le cookie `active_org` n'est qu'une préférence. Les services métier (`lib/*/service.ts`) refont les contrôles (`can()`, `getCardForActor()`), même si l'appelant les a déjà faits.
- **Isolation entre organisations** : toutes les tables métier portent `organization_id`, toutes les requêtes filtrent dessus, et une ressource d'une autre organisation renvoie « introuvable ». Le service refuse tout média référencé qui appartient à une autre organisation.
- **CSRF** : actions serveur Next.js (contrôle de l'origine intégré), routes API à cookie vérifiées par `isSameOrigin`. Webhooks Stripe authentifiés par signature.
- **XSS** : texte riche limité, rendu en éléments React, jamais d'HTML utilisateur ; aucune intégration HTML. URL validées (http, https, mailto, tel) ; `javascript:`, `data:`, `file:` et les identifiants dans l'URL sont refusés.
- **Redirections ouvertes** : `safeInternalPath` sur les paramètres `next`.
- **SSRF** : aucune récupération d'URL fournie par l'utilisateur côté serveur. Les vidéos ne passent que par des identifiants YouTube ou Vimeo.
- **Médias** : vrai type détecté par signature binaire, tailles et dimensions bornées, ré-encodage des images (métadonnées EXIF et GPS supprimées), SVG refusé, noms de stockage aléatoires, en-têtes `nosniff` et CSP `sandbox`, `Content-Disposition` sur les PDF, quota vérifié dans une transaction verrouillée.
- **Secrets** uniquement en variables d'environnement : aucun dans le dépôt, les journaux ou le navigateur. L'interface d'administration n'affiche que des indicateurs de configuration.
- **Limitation de débit** : Better Auth (stockage en base) pour l'authentification ; limiteur en mémoire pour les formulaires publics et les mesures. **Avec plusieurs instances, remplacer ce limiteur par un stockage partagé** (Redis ou table PostgreSQL).
- **Journal d'audit** des actions critiques : publication, archivage, membres, marque, facturation, assistance, administration.
- **MFA** (TOTP) obligatoire pour l'espace `/admin`.

## Données et contraintes

Voir `src/lib/db/schema.ts`. Contraintes notables :
- unicité `organization.slug`, `(card.organization_id, card.slug)` et `card.public_token` ;
- anciennes adresses : unicité de `slug_redirect` par organisation ; une ancienne adresse d'organisation reste réservée à celle-ci ;
- `billing_event.stripe_event_id` unique (idempotence des webhooks), `subscription.stripe_subscription_id` unique ;
- `analytics_event (view_id, type, target)` unique (déduplication des clics) ;
- `card_version (card_id, number)` unique, versions immuables ;
- documents de carte versionnés (`schemaVersion`), validés par Zod, migrés par `migrateDocument()`.

Suppressions en cascade : la suppression physique d'une organisation entraîne celle de ses données. En pratique, la suppression par le client est **logique** (`deleted_at`) : les cartes deviennent indisponibles immédiatement, et la purge définitive reste à planifier selon la politique de conservation. Les références de factures doivent être conservées séparément, selon les obligations comptables.

## Cache et désactivation

Les pages de carte sont rendues dynamiquement (`force-dynamic`) et la redirection du QR est envoyée avec `no-store` : la désactivation est immédiate. Les médias publics ont un cache navigateur de 5 minutes, sans cache partagé (`CDN-Cache-Control: no-store`). Si un CDN est ajouté, il faut purger les adresses `/m/*`, `/{org}/*` et `/r/*` au retrait d'une carte, à la fin d'un droit ou lors d'une suspension.

Les variantes réduites des images publiques (`/m/{id}?w=160|320|640|960`) sont gardées en mémoire par instance (48 Mo maximum, les plus anciennes sont évincées). Elles suivent exactement le même contrôle d'accès que l'original, vérifié avant toute lecture du cache.

## Environnements

| Environnement | Base | Stripe | Emails | Stockage |
|---|---|---|---|---|
| local | `cartes_dev` | aucune clé (mode local) ou `sk_test` | `log` (`/dev/emails`) | disque |
| test automatisé | `cartes_test`, `cartes_e2e` | faux client et signatures de test | `log` | disque |
| recette | base dédiée | `sk_test` + webhook de test | SMTP de test | bucket de test |
| production | base gérée sauvegardée | `sk_live` + `STRIPE_ALLOW_LIVE=true` | SMTP réel | bucket privé |

## Coûts par poste (hypothèses, sans montant inventé)

Aucun tarif n'a pu être consulté depuis l'environnement de développement. Les montants sont à relever sur les sites officiels des fournisseurs retenus, à la date du choix.

| Poste | Dimensionnement de départ | Variables de coût |
|---|---|---|
| Hébergement de l'application | 1 instance Node.js, 1 vCPU, 1 à 2 Go | instance, trafic sortant |
| PostgreSQL géré | 1 à 2 Go de RAM, 10 à 20 Go de disque, sauvegardes quotidiennes | taille, rétention des sauvegardes |
| Stockage d'objets | environ 1 Mo par carte (images WebP réduites) | Go stockés, requêtes, trafic |
| Emails transactionnels | quelques emails par organisation et par mois | volume mensuel |
| Stripe | commission par transaction et options Billing | à vérifier sur la grille tarifaire Stripe |
| Domaine, TLS | 1 domaine | annuel |

Hypothèse d'usage : 1 000 organisations, 3 000 cartes, 300 000 événements de mesure par mois. Ce volume reste raisonnable pour une seule instance et une base modeste (index sur `organization_id, occurred_at`).

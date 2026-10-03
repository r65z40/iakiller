# Installation

Ce guide couvre trois situations :

1. [Poste de développement](#1-poste-de-développement) : essayer l'application en local, en une quinzaine de minutes.
2. [Serveur de production](#2-serveur-de-production) : un serveur Ubuntu 24.04 avec HTTPS, tâches planifiées et sauvegardes.
3. [Mises à jour](#3-mettre-à-jour) et [dépannage](#4-dépannage).

Après chaque installation, lancez `npm run doctor` : la commande vérifie la configuration point par point et indique quoi corriger.

---

## Ce qu'il faut

| Élément | Version | Rôle |
|---|---|---|
| Node.js | 22 LTS (20.9 minimum) | exécute l'application et les tâches |
| PostgreSQL | 16 | base de données |
| Client PostgreSQL (`pg_dump`, `pg_restore`) | même version majeure que le serveur, ou plus récente | sauvegardes |
| Stockage S3 compatible | — | fichiers des clients en production (le disque local suffit en développement) |
| Serveur SMTP | — | emails : confirmation d'adresse, invitations, alertes |
| Compte Stripe | — | abonnements et prestations (facultatif pour essayer) |
| Nom de domaine + HTTPS | — | adresses des cartes et QR codes |

---

## 1. Poste de développement

### 1.1 Installer les prérequis

Ubuntu ou Debian :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql-16 postgresql-client-16 git
```

macOS (Homebrew) :

```bash
brew install node@22 postgresql@16
brew services start postgresql@16
```

### 1.2 Récupérer le code et les dépendances

```bash
git clone <adresse du dépôt> carto
cd carto
npm install
```

### 1.3 Créer la base de données

```bash
sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD 'cartes' CREATEDB;"
sudo -u postgres createdb -O cartes cartes_dev
```

### 1.4 Configurer

```bash
cp .env.example .env
```

Dans `.env`, renseignez au minimum :

```bash
DATABASE_URL=postgres://cartes:cartes@localhost:5432/cartes_dev
BETTER_AUTH_SECRET=<résultat de : openssl rand -base64 48>
```

Les autres valeurs peuvent rester par défaut. Les emails ne partent pas (`EMAIL_MODE=log`), les fichiers vont dans `./storage`, Stripe est désactivé et les sauvegardes vont dans `./backups`.

### 1.5 Initialiser et lancer

```bash
npm run db:migrate   # crée les tables
npm run db:seed      # plans, prestation et organisation de démonstration
npm run dev          # http://localhost:3000
```

Pour vous connecter, utilisez le compte de démonstration `demo@exemple.test` (mot de passe `demo-carte-2026`). Une carte publique d'exemple est visible sur http://localhost:3000/atelier-exemple/camille-moreau-atelier-moreau.

Pour créer votre propre compte, inscrivez-vous sur `/inscription` : le lien de confirmation s'affiche sur **http://localhost:3000/dev/emails**.

### 1.6 Devenir administrateur de la plateforme

```bash
npm run admin:create -- --email vous@exemple.test            # rôle admin
npm run admin:create -- --email support@exemple.test --role support
```

Connectez-vous, puis activez la double authentification sur `/admin/securite`. Elle est obligatoire pour accéder à l'administration.

### 1.7 Lancer les tests (facultatif)

```bash
sudo -u postgres createdb -O cartes cartes_test
sudo -u postgres createdb -O cartes cartes_e2e
DATABASE_URL=postgres://cartes:cartes@localhost:5432/cartes_test npm run db:migrate
DATABASE_URL=postgres://cartes:cartes@localhost:5432/cartes_e2e npm run db:migrate

npm run typecheck && npm run lint
npm test              # tests unitaires et d'intégration (PostgreSQL réel)
npx playwright install chromium && npm run test:e2e   # parcours navigateur
```

---

## 2. Serveur de production

Architecture conseillée : **un seul serveur** (2 vCPU et 4 Go de RAM suffisent pour démarrer) qui fait tourner l'application et les tâches planifiées. Il s'appuie sur :
- une base PostgreSQL 16, gérée par l'hébergeur (recommandé) ou installée sur le serveur ;
- un bucket S3 **privé** pour les fichiers des clients ;
- un **second** bucket S3, chez un autre fournisseur ou dans une autre région, pour les sauvegardes.

Les commandes ci-dessous supposent Ubuntu 24.04 et le domaine `cartes.exemple.fr`, à remplacer par le vôtre.

### 2.1 Système

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git postgresql-client-16 caddy
sudo adduser --system --group --home /opt/carto carto
```

> Si la base est gérée chez un hébergeur en PostgreSQL 17, installez `postgresql-client-17` : `pg_dump` doit être au moins de la version du serveur. `npm run doctor` le vérifie.

Si la base est sur le même serveur :

```bash
sudo apt install -y postgresql-16
sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD '<mot de passe fort>';"
sudo -u postgres createdb -O cartes cartes
```

### 2.2 Code

```bash
sudo -u carto git clone <adresse du dépôt> /opt/carto
cd /opt/carto
sudo -u carto npm ci
sudo -u carto mkdir -p storage backups .npm
```

N'utilisez pas `npm ci --omit=dev` : les tâches planifiées et les commandes d'exploitation (`jobs`, `backup`, `doctor`, `db:migrate`) s'exécutent avec `tsx`, qui est une dépendance de développement.

### 2.3 Configuration (`/opt/carto/.env`)

```bash
sudo -u carto cp .env.example .env
sudo chmod 600 .env
```

Valeurs à renseigner (le détail de chaque variable figure dans `.env.example`) :

| Variable | Valeur en production |
|---|---|
| `APP_URL` | `https://cartes.exemple.fr` |
| `DATABASE_URL` | adresse de la base de production |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48`, à ne jamais changer ensuite (sinon toutes les sessions sont fermées) |
| `EMAIL_MODE`, `SMTP_URL`, `EMAIL_FROM` | `smtp`, `smtps://utilisateur:motdepasse@smtp.fournisseur.fr:465`, `Marque <no-reply@exemple.fr>` (domaine autorisé SPF/DKIM) |
| `STORAGE_DRIVER`, `S3_*` | `s3` et les accès du bucket **privé** des fichiers |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | voir [STRIPE.md](STRIPE.md) ; `STRIPE_ALLOW_LIVE=true` uniquement pour les clés live |
| `BACKUP_DRIVER`, `BACKUP_S3_*` | `s3` et le bucket **dédié** aux sauvegardes, voir [SAUVEGARDE.md](SAUVEGARDE.md) |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -base64 32`, **copiée aussi dans un gestionnaire de mots de passe hors du serveur** |
| `BACKUP_RESTORE_TEST_DATABASE_URL` | une base vide dédiée aux essais de restauration (facultatif mais conseillé) |
| `APPLE_WALLET_*`, `GOOGLE_WALLET_*` | facultatif, voir [WALLET.md](WALLET.md) |

Le nom de marque, le domaine public, les informations de la société, les durées de conservation et les autres règles se règlent ensuite dans l'administration (`/admin/reglages`). Les valeurs de `.env` ne servent que de point de départ.

### 2.4 Base de données et compilation

```bash
cd /opt/carto
sudo -u carto npm run db:migrate
sudo -u carto npm run db:seed        # facultatif : plans de départ (marqués « démonstration »)
sudo -u carto npm run build
```

### 2.5 Services

```bash
sudo cp deploy/systemd/carto.service deploy/systemd/carto-jobs.service deploy/systemd/carto-jobs.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now carto carto-jobs.timer
systemctl status carto
```

- `carto.service` : l'application, sur `127.0.0.1:3000`, redémarrée automatiquement.
- `carto-jobs.timer` : lance `npm run jobs` toutes les 15 minutes. Cette commande envoie les rappels, réconcilie Stripe, relance les emails en échec, agrège les statistiques, applique la conservation et **déclenche les sauvegardes**.

Si le stockage local ou les sauvegardes locales sont placés ailleurs que dans `/opt/carto`, adaptez `ReadWritePaths` dans les deux fichiers de service.

### 2.6 HTTPS

Caddy obtient et renouvelle le certificat automatiquement :

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/cartes.exemple.fr/votre-domaine.fr/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Le DNS du domaine (enregistrements A et AAAA) doit pointer vers le serveur. Avec Nginx, utilisez `deploy/nginx.conf` et `certbot --nginx`.

Le proxy doit transmettre `X-Forwarded-For`, qui sert à la limitation de débit. Seul un proxy que vous maîtrisez doit pouvoir joindre le port 3000. Fermez-le au public :

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

### 2.7 Premier administrateur

1. Inscrivez-vous sur `https://cartes.exemple.fr/inscription` et confirmez votre adresse (vrai email).
2. `cd /opt/carto && sudo -u carto npm run admin:create -- --email vous@exemple.fr`
3. Reconnectez-vous et activez la double authentification sur `/admin/securite`.

### 2.8 Mise en service

1. `sudo -u carto npm run doctor` : il ne doit rester aucun point bloquant.
2. Dans `/admin/reglages`, renseignez la marque et le domaine, la société, les règles de tarification, les durées de conservation et les validations juridiques.
3. Dans `/admin/plans`, saisissez les prix réels, les identifiants de prix Stripe et retirez les marqueurs « démonstration ».
4. Dans `/admin/sauvegardes`, cliquez sur **Sauvegarder maintenant** et vérifiez que la sauvegarde réussit. Si une base d'essai est configurée, cliquez ensuite sur **Tester la restauration**.
5. Le tableau de bord `/admin` liste tout ce qui bloque encore le lancement commercial.

---

## 3. Mettre à jour

```bash
cd /opt/carto
sudo -u carto npm run backup -- run      # sauvegarde avant toute mise à jour
sudo -u carto git pull
sudo -u carto npm ci
sudo -u carto npm run db:migrate
sudo -u carto npm run build
sudo systemctl restart carto
sudo -u carto npm run doctor
```

Les migrations sont versionnées dans `drizzle/` et s'appliquent dans l'ordre. En cas de problème après une mise à jour, revenez au commit précédent (`git checkout <commit>`). Si une migration a modifié la base, restaurez la sauvegarde faite juste avant, comme décrit dans [SAUVEGARDE.md](SAUVEGARDE.md).

### Changer de domaine

1. Faites pointer le nouveau domaine vers le serveur et ajoutez-le au `Caddyfile`.
2. Gardez une redirection permanente depuis l'ancien domaine : les QR codes déjà imprimés continueront de fonctionner.
3. Modifiez le domaine public dans `/admin/reglages`, puis `APP_URL` au déploiement suivant, et redémarrez.

---

## 4. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `npm run doctor` : « Migrations x/y » | migrations non appliquées | `npm run db:migrate` |
| Aucun email reçu | `EMAIL_MODE=log` ou SMTP refusé | `npm run doctor` teste la connexion SMTP ; vérifier SPF/DKIM du domaine expéditeur |
| « pg_dump introuvable » ou version inférieure au serveur | client PostgreSQL absent ou trop ancien | `sudo apt install postgresql-client-<version du serveur>` |
| Connexion impossible après inscription | adresse non confirmée | lien dans l'email (en développement : `/dev/emails`) |
| `/admin` renvoie vers `/admin/securite` | double authentification non activée | l'activer avec une application TOTP |
| Paiements refusés au démarrage | prix encore marqués « démonstration » ou clé live sans `STRIPE_ALLOW_LIVE=true` | `/admin/plans` et `.env` |
| Les cartes ne s'affichent plus | essai terminé, abonnement échu ou carte suspendue | comportement voulu : voir [ETATS-ABONNEMENT.md](ETATS-ABONNEMENT.md) |
| Bandeau rouge « Sauvegardes » dans `/admin` | aucune sauvegarde réussie récente | `/admin/sauvegardes` affiche l'erreur ; vérifier `systemctl status carto-jobs.timer` |
| Journaux de l'application | — | `journalctl -u carto -f` et `journalctl -u carto-jobs` |

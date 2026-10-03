# Installation de MaCartePro

Ce guide est volontairement détaillé : **chaque commande est écrite en entier**, même les plus
simples, pour qu'une personne débutante puisse suivre pas à pas sans rien deviner.

Trois parcours :

1. [Installer sur votre ordinateur (découverte / développement)](#1-installer-sur-votre-ordinateur) — environ 15 minutes.
2. [Installer sur un serveur (production)](#2-installer-sur-un-serveur-production) — pour mettre le service en ligne.
3. [Mettre à jour](#3-mettre-à-jour) et [Dépannage](#4-dépannage).

> **Comment utiliser ce guide ?** Ouvrez un **terminal** (sur Windows, voir l'encadré ci‑dessous),
> puis copiez‑collez les commandes **une par une**, en appuyant sur Entrée après chacune. Les
> lignes qui commencent par `#` sont des commentaires : elles expliquent, elles ne s'exécutent pas.

<details>
<summary>Où trouver le terminal ?</summary>

- **Windows** : installez d'abord « WSL » (Ubuntu dans Windows). Ouvrez *PowerShell* en
  administrateur et tapez `wsl --install`, redémarrez, puis ouvrez l'application **Ubuntu**.
  Toutes les commandes de ce guide se tapent dans cette fenêtre Ubuntu.
- **macOS** : ouvrez l'application **Terminal** (Spotlight → tapez « Terminal »).
- **Linux** : ouvrez votre application **Terminal** habituelle.

</details>

---

## Ce qu'il faut

| Élément | À quoi ça sert | Obligatoire ? |
|---|---|---|
| **Node.js 22** (20.9 minimum) | fait tourner l'application | Oui |
| **PostgreSQL 16** | la base de données | Oui |
| **Git** | télécharger le projet | Oui |
| Client PostgreSQL (`pg_dump`) | les sauvegardes | Oui (fourni avec PostgreSQL) |
| Compte **Stripe** | encaisser les abonnements | Non (facultatif pour essayer) |
| Serveur **SMTP** | envoyer les emails | Non en local, oui en production |
| **Nom de domaine + HTTPS** | mettre en ligne | Production uniquement |

---

## 1. Installer sur votre ordinateur

### Étape 1 — Installer les prérequis

**Sur Ubuntu / Debian / Windows (WSL)**, copiez ces deux commandes, l'une après l'autre :

```bash
# 1) Ajouter la source officielle de Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# 2) Installer Node.js, PostgreSQL, le client PostgreSQL et Git
sudo apt install -y nodejs postgresql-16 postgresql-client-16 git
```

**Sur macOS** (avec [Homebrew](https://brew.sh)) :

```bash
# Installer Node.js, PostgreSQL et Git
brew install node@22 postgresql@16 git

# Démarrer PostgreSQL
brew services start postgresql@16
```

**Vérifiez que tout est bien installé** (chaque commande doit afficher un numéro de version) :

```bash
node -v      # doit afficher v22.x (ou v20.9 minimum)
psql --version
git --version
```

Si une commande répond « command not found » (commande introuvable), c'est que l'installation
précédente n'a pas fonctionné : reprenez l'étape 1.

### Étape 2 — Télécharger le projet

Remplacez `<adresse du dépôt>` par l'adresse Git du projet (celle qui finit par `.git`) :

```bash
# Télécharger le code dans un dossier nommé "macartepro"
git clone <adresse du dépôt> macartepro

# Entrer dans ce dossier (toutes les commandes suivantes s'y exécutent)
cd macartepro
```

### Étape 3 — Lancer l'installation

Vous avez deux possibilités. **L'option A fait tout pour vous** ; l'option B détaille chaque
commande si vous préférez comprendre ou personnaliser.

#### Option A — Tout automatique (recommandé)

```bash
# Rend le script exécutable (à faire une seule fois)
chmod +x install.sh

# Lance l'installation guidée
./install.sh
```

Le script pose quelques questions simples (nom de la marque, adresse, base de données) avec des
valeurs par défaut : il suffit souvent d'appuyer sur **Entrée** à chaque question. Il installe
les dépendances, **génère automatiquement les mots de passe secrets**, crée la base de données,
prépare les tables, ajoute des données d'exemple, puis vérifie que tout est en ordre.

Pour une installation **sans aucune question** (valeurs par défaut, en local) :

```bash
./install.sh --yes
```

#### Option B — Étape par étape (toutes les commandes)

```bash
# 1) Installer les dépendances du projet
npm install

# 2) Créer le fichier de configuration à partir de l'exemple
cp .env.example .env

# 3) Générer les deux secrets et les inscrire dans le fichier .env
#    (le premier sécurise les connexions, le second chiffre les sauvegardes)
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 48)" >> .env
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# 4) Créer l'utilisateur et la base de données PostgreSQL
sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD 'cartes' CREATEDB;"
sudo -u postgres createdb -O cartes macartepro

# 5) Indiquer l'adresse de la base dans .env
echo "DATABASE_URL=postgres://cartes:cartes@localhost:5432/macartepro" >> .env

# 6) Créer les tables de la base
npm run db:migrate

# 7) Ajouter les formules et une organisation de démonstration
npm run db:seed
```

> **Important** : la commande `openssl rand ...` du point 3 fabrique un mot de passe aléatoire
> unique. Ne la remplacez pas par une valeur fixe, et ne partagez jamais le contenu de `.env`.

### Étape 4 — Démarrer l'application

```bash
npm run dev
```

Laissez cette fenêtre ouverte, puis ouvrez votre navigateur sur **http://localhost:3000**.
Pour arrêter l'application, revenez dans le terminal et appuyez sur `Ctrl + C`.

### Étape 5 — Se connecter et regarder

- **Compte de démonstration** : email `demo@exemple.test`, mot de passe `demo-carte-2026`.
- **Carte publique d'exemple** : http://localhost:3000/atelier-exemple/camille-moreau-atelier-moreau
- **Vos emails en local** : aucun email n'est réellement envoyé. Les liens (confirmation,
  invitations…) s'affichent sur **http://localhost:3000/dev/emails**.

Pour créer **votre** compte, cliquez sur « Essai gratuit », inscrivez‑vous, puis récupérez le
lien de confirmation sur `/dev/emails`.

### Étape 6 — Devenir administrateur

Après vous être inscrit **et** avoir confirmé votre email, ouvrez un **nouveau** terminal dans le
dossier `macartepro` (laissez `npm run dev` tourner dans l'autre) et tapez :

```bash
# Donner le rôle administrateur à votre compte (remplacez l'email)
npm run admin:create -- --email vous@exemple.test
```

Reconnectez‑vous, puis activez la **double authentification** sur http://localhost:3000/admin/securite
(obligatoire pour accéder à l'administration).

### (Facultatif) Vérifier et tester

```bash
# Vérifier la configuration à tout moment
npm run doctor

# Lancer les tests automatisés (nécessite deux bases dédiées)
sudo -u postgres createdb -O cartes cartes_test
sudo -u postgres createdb -O cartes cartes_e2e
DATABASE_URL=postgres://cartes:cartes@localhost:5432/cartes_test npm run db:migrate
DATABASE_URL=postgres://cartes:cartes@localhost:5432/cartes_e2e npm run db:migrate
npm run typecheck
npm run lint
npm test                               # 117 tests unitaires et d'intégration
npx playwright install chromium
npm run test:e2e                       # 6 parcours de navigateur
```

---

## 2. Installer sur un serveur (production)

Pour mettre le service **en ligne**. Objectif : un serveur **Ubuntu 24.04**, un nom de domaine,
et le HTTPS automatique. Les commandes supposent le domaine `cartes.exemple.fr` — **remplacez‑le
partout par le vôtre**.

Architecture conseillée : un seul serveur (2 vCPU, 4 Go de RAM suffisent au démarrage) avec :
une base PostgreSQL 16, un bucket S3 **privé** pour les fichiers des clients, et un **second**
bucket S3 (autre fournisseur ou autre région) pour les sauvegardes.

### Étape 1 — Préparer le serveur

```bash
# Mettre le système à jour
sudo apt update && sudo apt upgrade -y

# Installer Node.js 22, Git, le client PostgreSQL et le serveur web Caddy (HTTPS automatique)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git postgresql-client-16 caddy

# Créer un utilisateur dédié, sans droits superflus, pour faire tourner l'application
sudo adduser --system --group --home /opt/macartepro macartepro
```

> Si votre base est hébergée ailleurs en PostgreSQL 17, installez plutôt
> `postgresql-client-17` : l'outil de sauvegarde `pg_dump` doit être au moins de la version du
> serveur. `npm run doctor` le vérifie.

**Si la base de données est sur ce même serveur**, installez‑la et créez‑la :

```bash
sudo apt install -y postgresql-16
sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD 'un-mot-de-passe-solide';"
sudo -u postgres createdb -O cartes macartepro
```

### Étape 2 — Récupérer le code

```bash
# Télécharger le projet dans /opt/macartepro (au nom de l'utilisateur dédié)
sudo -u macartepro git clone <adresse du dépôt> /opt/macartepro

# Se placer dans le dossier
cd /opt/macartepro

# Installer les dépendances (exactement celles verrouillées)
sudo -u macartepro npm ci

# Créer les dossiers de travail
sudo -u macartepro mkdir -p storage backups .npm
```

> N'utilisez pas `npm ci --omit=dev` : les tâches planifiées et les commandes d'exploitation
> (`jobs`, `backup`, `doctor`, `db:migrate`) ont besoin d'une dépendance de développement (`tsx`).

### Étape 3 — Configurer

```bash
# Créer le fichier de configuration et le protéger
sudo -u macartepro cp .env.example .env
sudo chmod 600 /opt/macartepro/.env

# Générer les deux secrets
sudo -u macartepro bash -c 'echo "BETTER_AUTH_SECRET=$(openssl rand -base64 48)" >> .env'
sudo -u macartepro bash -c 'echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env'

# Ouvrir le fichier pour renseigner le reste (Ctrl+O pour enregistrer, Ctrl+X pour quitter)
sudo -u macartepro nano /opt/macartepro/.env
```

Dans ce fichier, renseignez au minimum :

| Variable | Valeur en production |
|---|---|
| `APP_URL` | `https://cartes.exemple.fr` |
| `DATABASE_URL` | l'adresse de votre base |
| `EMAIL_MODE`, `SMTP_URL`, `EMAIL_FROM` | `smtp` · `smtps://utilisateur:motdepasse@smtp.fournisseur.fr:465` · `MaCartePro <no-reply@exemple.fr>` (domaine autorisé SPF/DKIM) |
| `STORAGE_DRIVER`, `S3_*` | `s3` et les accès du bucket **privé** des fichiers |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | voir [STRIPE.md](STRIPE.md) ; ajoutez `STRIPE_ALLOW_LIVE=true` pour une clé live |
| `BACKUP_DRIVER`, `BACKUP_S3_*` | `s3` et le bucket **dédié** aux sauvegardes ([SAUVEGARDE.md](SAUVEGARDE.md)) |
| `BACKUP_RESTORE_TEST_DATABASE_URL` | une base vide pour tester les restaurations (conseillé) |
| `APPLE_WALLET_*`, `GOOGLE_WALLET_*` | facultatif ([WALLET.md](WALLET.md)) |

> **Gardez une copie de `BACKUP_ENCRYPTION_KEY` hors du serveur** (gestionnaire de mots de
> passe) : sans elle, les sauvegardes chiffrées sont illisibles.

La marque, le domaine, les informations de société et les règles se finaliseront ensuite dans
l'administration (`/admin/reglages`) : les valeurs de `.env` ne sont qu'un point de départ.

### Étape 4 — Préparer la base et compiler

```bash
cd /opt/macartepro
sudo -u macartepro npm run db:migrate     # crée / met à jour les tables
sudo -u macartepro npm run db:seed        # (facultatif) formules de départ
sudo -u macartepro npm run build          # compile la version de production
```

### Étape 5 — Démarrer automatiquement (services systemd)

```bash
# Copier les fichiers de service fournis
sudo cp deploy/systemd/macartepro.service deploy/systemd/macartepro-jobs.service deploy/systemd/macartepro-jobs.timer /etc/systemd/system/

# Recharger systemd puis démarrer l'application et les tâches planifiées
sudo systemctl daemon-reload
sudo systemctl enable --now macartepro macartepro-jobs.timer

# Vérifier que l'application tourne
systemctl status macartepro
```

- `macartepro.service` : l'application, sur `127.0.0.1:3000`, redémarrée automatiquement.
- `macartepro-jobs.timer` : lance les tâches toutes les 15 minutes (rappels, synchronisation
  Stripe, emails, statistiques, conservation **et sauvegardes**).

### Étape 6 — Activer le HTTPS

```bash
# Installer la configuration Caddy fournie et y mettre votre domaine
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/cartes.exemple.fr/votre-domaine.fr/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Le DNS de votre domaine (enregistrements A et AAAA) doit pointer vers ce serveur. Caddy obtient
et renouvelle le certificat tout seul. (Alternative : `deploy/nginx.conf` avec `certbot --nginx`.)

**Fermez l'accès direct** et n'ouvrez que le web et SSH :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

### Étape 7 — Créer l'administrateur

1. Allez sur `https://cartes.exemple.fr/inscription`, inscrivez‑vous et confirmez votre (vrai) email.
2. Donnez‑vous le rôle administrateur :
   ```bash
   cd /opt/macartepro
   sudo -u macartepro npm run admin:create -- --email vous@exemple.fr
   ```
3. Reconnectez‑vous et activez la double authentification sur `/admin/securite`.

### Étape 8 — Dernières étapes avant d'ouvrir à la vente

```bash
# Vérifier qu'il ne reste aucun point bloquant
sudo -u macartepro npm run doctor
```

Puis, dans l'administration :

1. **`/admin/reglages`** : marque, domaine, informations de la société, règles de tarification,
   conservation, et validation juridique des pages légales.
2. **`/admin/plans`** : une fois `STRIPE_SECRET_KEY` renseignée, cliquez sur **« Créer /
   synchroniser les prix dans Stripe »** : les produits et prix sont créés automatiquement et
   les identifiants remplis. Le marquage « démonstration » disparaît.
3. **`/admin/sauvegardes`** : cliquez sur **« Sauvegarder maintenant »** et vérifiez la réussite.
4. Le tableau de bord **`/admin`** liste en permanence ce qui bloque encore le lancement.

---

## 3. Mettre à jour

```bash
cd /opt/macartepro
sudo -u macartepro npm run backup -- run   # sauvegarde AVANT la mise à jour
sudo -u macartepro git pull                # récupère la nouvelle version
sudo -u macartepro npm ci                  # met à jour les dépendances
sudo -u macartepro npm run db:migrate      # applique les nouvelles migrations
sudo -u macartepro npm run build           # recompile
sudo systemctl restart macartepro          # redémarre l'application
sudo -u macartepro npm run doctor          # vérifie
```

En cas de souci après mise à jour, revenez à la version précédente (`git checkout <commit>`) ;
si la base a changé, restaurez la sauvegarde faite juste avant (voir [SAUVEGARDE.md](SAUVEGARDE.md)).

---

## 4. Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| `command not found` (node, psql, git) | prérequis non installés | reprendre l'étape 1 |
| `npm run doctor` affiche « Migrations x/y » | tables non à jour | `npm run db:migrate` |
| Connexion impossible après inscription | email non confirmé | ouvrir le lien (en local : `/dev/emails`) |
| `/admin` renvoie vers `/admin/securite` | double authentification non activée | l'activer avec une application d'authentification (TOTP) |
| Aucun email reçu | `EMAIL_MODE=log` ou SMTP refusé | en production mettre `EMAIL_MODE=smtp` ; vérifier SPF/DKIM |
| « pg_dump introuvable » | client PostgreSQL manquant/ancien | `sudo apt install postgresql-client-<version du serveur>` |
| Paiements refusés au démarrage | prix encore en « démonstration » ou clé live sans `STRIPE_ALLOW_LIVE=true` | `/admin/plans` et `.env` |
| Bandeau rouge « Sauvegardes » dans `/admin` | aucune sauvegarde récente | `/admin/sauvegardes` ; `systemctl status macartepro-jobs.timer` |
| Voir les journaux du serveur | — | `journalctl -u macartepro -f` et `journalctl -u macartepro-jobs` |

Besoin d'aide sur une fonctionnalité précise ? Voir le [guide des fonctionnalités](FONCTIONNALITES.md).

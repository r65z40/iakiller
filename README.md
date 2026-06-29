# IAKiller — Rendez votre contenu IA indétectable

Plateforme gratuite de nettoyage de contenu généré par IA. Supprimez les métadonnées, modifiez les empreintes numériques et nettoyez les traces laissées par les outils d'IA générative.

---

## Prérequis

- **Node.js** version 18 ou supérieure — [Télécharger Node.js](https://nodejs.org/)
- **npm** (inclus avec Node.js)
- **FFmpeg** (optionnel, pour le traitement vidéo avancé) — [Télécharger FFmpeg](https://ffmpeg.org/download.html)

Pour vérifier que Node.js est installé :

```bash
node --version   # doit afficher v18.x.x ou supérieur
npm --version    # doit afficher 9.x.x ou supérieur
```

---

## Installation pas à pas

### 1. Cloner le projet

```bash
git clone https://github.com/r65z40/iakiller.git
cd iakiller
```

### 2. Installer les dépendances

```bash
npm install
```

Cette commande installe automatiquement toutes les librairies nécessaires (Next.js, Sharp pour le traitement d'images, etc.).

### 3. Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet :

```bash
cp .env.example .env
```

Ou créez-le manuellement avec ce contenu :

```env
# Clé secrète pour les tokens JWT (changez cette valeur en production !)
JWT_SECRET=votre-cle-secrete-unique-ici

# Identifiants de l'administrateur par défaut
ADMIN_EMAIL=admin@iakiller.com
ADMIN_PASSWORD=admin123
```

> **Important** : En production, utilisez une clé JWT longue et aléatoire. Vous pouvez en générer une avec :
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 4. Lancer l'application

**Mode développement** (avec rechargement automatique) :

```bash
npm run dev
```

**Mode production** (optimisé) :

```bash
npm run build
npm start
```

L'application est accessible sur **http://localhost:3000**

#### Utiliser un port différent

Par défaut, Next.js utilise le port 3000. Pour changer de port :

```bash
# Mode développement sur le port 8080
npm run dev -- -p 8080

# Mode production sur le port 8080
npm run build
npm start -- -p 8080
```

Vous pouvez aussi définir le port via la variable d'environnement `PORT` :

```bash
# Ajoutez dans votre .env
PORT=8080

# Ou directement en ligne de commande
PORT=8080 npm run dev
PORT=8080 npm start
```

> **Astuce** : Si le port 3000 est déjà utilisé par une autre application, Next.js vous proposera automatiquement le port suivant (3001, 3002, etc.).

---

## Utilisation

### Outil de nettoyage (pour les visiteurs)

1. Allez sur **http://localhost:3000/tool**
2. Choisissez un onglet : **Image**, **Texte** ou **Vidéo**
3. Uploadez votre fichier ou collez votre texte
4. Configurez les options de traitement si nécessaire
5. Cliquez sur le bouton de nettoyage
6. Téléchargez le résultat

#### Options de traitement image

| Option | Description |
|--------|-------------|
| Bruit subtil | Ajoute une variation de pixels imperceptible à l'œil nu |
| Décalage couleur | Modifie légèrement la luminosité et la saturation |
| Micro-recadrage | Recadre de 1-3 pixels sur les bords |
| Qualité | Contrôle la compression (60-100%) |
| Format | Choisir JPEG, PNG ou WebP en sortie |

#### Options de traitement texte

| Option | Description |
|--------|-------------|
| Supprimer patterns IA | Détecte et remplace les expressions typiques de l'IA |
| Varier les phrases | Modifie la structure des phrases |
| Imperfections naturelles | Ajoute des variations naturelles au texte |
| Langue | Auto-détection, Français ou Anglais |

### Espace Administration

1. Allez sur **http://localhost:3000/admin/login**
2. Connectez-vous avec vos identifiants (par défaut : `admin@iakiller.com` / `admin123`)
3. Vous accédez au dashboard avec 4 sections :

| Section | Description |
|---------|-------------|
| **Dashboard** | Vue d'ensemble : traitements, utilisateurs, performance des pubs |
| **Publicités** | Créer, modifier, activer/désactiver des emplacements publicitaires |
| **Utilisateurs** | Liste des sessions, historique des traitements |
| **Statistiques** | Graphiques détaillés, répartition par type, CTR des pubs |

#### Configurer une publicité

1. Allez dans **Publicités** > **Nouvelle publicité**
2. Remplissez les champs :
   - **Nom** : pour identifier la pub dans l'admin
   - **Type** : Bannière, Sidebar, Interstitiel ou Natif
   - **Position** : Haut de page, Dans le contenu, Barre latérale ou Bas de page
   - **URL cible** : vers où redirige le clic
   - **Contenu HTML** : votre code pub (AdSense, HTML personnalisé, etc.)
3. Activez-la et cliquez sur **Créer**

##### Exemple avec Google AdSense

Dans le champ "Contenu HTML", collez votre code AdSense :

```html
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-VOTRE_ID"
     data-ad-slot="VOTRE_SLOT"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

---

## Déploiement en production

### Option 1 : Vercel (recommandé, gratuit)

1. Créez un compte sur [vercel.com](https://vercel.com)
2. Importez votre repo GitHub
3. Ajoutez les variables d'environnement dans les paramètres du projet :
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
4. Déployez — Vercel détecte Next.js automatiquement

> **Note** : Sur Vercel, le stockage JSON local ne persiste pas entre les déploiements. Pour la production, envisagez d'utiliser une base de données externe (PostgreSQL, MongoDB, etc.).

### Option 2 : VPS (serveur dédié)

```bash
# Sur votre serveur (Ubuntu/Debian)
sudo apt update
sudo apt install -y nodejs npm

# Cloner et installer
git clone https://github.com/r65z40/iakiller.git
cd iakiller
npm install

# Configurer l'environnement
cp .env.example .env
nano .env   # éditez les valeurs

# Builder et lancer
npm run build
npm start

# Pour garder l'app active en arrière-plan, utilisez PM2 :
npm install -g pm2
pm2 start npm --name "iakiller" -- start
pm2 save
pm2 startup   # pour lancer au démarrage du serveur
```

### Option 3 : Docker

Créez un fichier `Dockerfile` :

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Puis :

```bash
docker build -t iakiller .
docker run -p 3000:3000 --env-file .env iakiller
```

---

## Installation de FFmpeg (optionnel, pour les vidéos)

Sans FFmpeg, le traitement vidéo se limite au nettoyage basique. Avec FFmpeg, l'outil ré-encode complètement la vidéo (nouveau codec, nouveaux paramètres), ce qui supprime toute trace technique.

### macOS

```bash
# Avec Homebrew (recommandé)
brew install ffmpeg

# Si Homebrew n'est pas installé :
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y ffmpeg
```

### Fedora / CentOS / RHEL

```bash
# Fedora
sudo dnf install ffmpeg

# CentOS / RHEL (nécessite EPEL + RPM Fusion)
sudo dnf install epel-release
sudo dnf install https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm
sudo dnf install ffmpeg
```

### Arch Linux

```bash
sudo pacman -S ffmpeg
```

### Windows

**Méthode 1 — avec winget (Windows 10/11)** :

```powershell
winget install FFmpeg
```

**Méthode 2 — manuelle** :

1. Allez sur [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/)
2. Téléchargez la version **release full** (fichier `.zip`)
3. Extrayez l'archive dans un dossier, par exemple `C:\ffmpeg`
4. Ajoutez `C:\ffmpeg\bin` au PATH système :
   - Ouvrez **Paramètres** > **Système** > **Informations système** > **Paramètres avancés du système**
   - Cliquez sur **Variables d'environnement**
   - Dans **Variables système**, sélectionnez `Path` > **Modifier**
   - Cliquez **Nouveau** et ajoutez `C:\ffmpeg\bin`
   - Validez avec **OK**
5. Fermez et rouvrez votre terminal

### Vérification

```bash
ffmpeg -version
```

Si la commande affiche les informations de version, FFmpeg est correctement installé. Relancez IAKiller pour qu'il le détecte automatiquement — aucune configuration supplémentaire n'est nécessaire.

---

## Structure du projet

```
iakiller/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── tool/page.tsx            # Outil (image/texte/vidéo)
│   │   ├── admin/
│   │   │   ├── login/page.tsx       # Connexion admin
│   │   │   ├── page.tsx             # Dashboard
│   │   │   ├── ads/page.tsx         # Gestion des publicités
│   │   │   ├── users/page.tsx       # Utilisateurs
│   │   │   └── stats/page.tsx       # Statistiques
│   │   └── api/                     # Routes API
│   ├── components/                  # Composants React
│   └── lib/
│       ├── db.ts                    # Base de données JSON
│       ├── auth.ts                  # Authentification JWT
│       └── processors/             # Moteurs de traitement
│           ├── image.ts             # Traitement images (Sharp)
│           ├── text.ts              # Traitement texte
│           └── video.ts             # Traitement vidéo (FFmpeg)
├── data/                            # Données persistantes (auto-créé)
├── .env                             # Variables d'environnement
└── package.json
```

---

## FAQ

**L'outil est-il vraiment gratuit ?**
Oui. Le modèle économique repose sur les publicités que vous configurez dans l'admin.

**Les fichiers sont-ils stockés sur le serveur ?**
Non. Les fichiers sont traités en mémoire et renvoyés immédiatement. Rien n'est sauvegardé.

**Ça fonctionne avec les images de DALL-E, Midjourney, Stable Diffusion ?**
Oui. Le traitement supprime les métadonnées (EXIF, C2PA, Content Credentials) et modifie l'empreinte numérique du fichier quelle que soit la source.

**Pourquoi le traitement vidéo est limité sans FFmpeg ?**
Sans FFmpeg, seul le nettoyage basique est possible. Avec FFmpeg, l'outil ré-encode complètement la vidéo avec de nouveaux paramètres, ce qui supprime toute trace technique.

**Comment changer le mot de passe admin ?**
Modifiez les valeurs `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans le fichier `.env`, puis supprimez le fichier `data/db.json` pour recréer le compte. Relancez ensuite l'application.

# Sauvegardes et restauration

Le système de sauvegarde protège **toutes les données nécessaires pour reconstruire la plateforme** : la base PostgreSQL (comptes, organisations, cartes et leurs versions, prospects, abonnements, réglages, journaux) et les fichiers envoyés par les clients (photos, logos, bannières, galeries, PDF).

Ce qu'il ne sauvegarde pas, et qui doit être conservé ailleurs :
- le fichier `.env` (secrets) ;
- les certificats Wallet ;
- la clé de chiffrement des sauvegardes elle-même.

Gardez une copie de ces éléments dans un gestionnaire de mots de passe ou un coffre-fort, hors du serveur.

## En bref

| | |
|---|---|
| Fréquence | automatique, chaque jour par défaut (6 h, 12 h, 24 h ou hebdomadaire), réglable dans `/admin/sauvegardes` |
| Contenu | export complet de la base + fichiers des médias |
| Fichiers | incrémental : un fichier déjà sauvegardé n'est jamais recopié |
| Chiffrement | AES-256-GCM (chiffrement authentifié) si `BACKUP_ENCRYPTION_KEY` est défini |
| Destination | bucket S3 dédié (recommandé) ou dossier local |
| Vérification | relecture et empreinte SHA-256 de chaque fichier écrit, lecture de l'export par `pg_restore` |
| Essai de restauration | automatique chaque semaine dans une base de test, avec comparaison des comptages |
| Conservation | dernière sauvegarde de chacun des 7 derniers jours, 4 dernières semaines et 6 derniers mois (réglable) |
| Alertes | email en cas d'échec, ou si aucune sauvegarde n'a réussi depuis deux fois la fréquence (26 h minimum) |
| Restauration | en ligne de commande, sans avoir besoin de la base d'origine |

## Configuration

Dans `.env` (voir aussi `.env.example`) :

```bash
# Destination : bucket DÉDIÉ, chez un autre fournisseur ou dans une autre région que les fichiers.
BACKUP_DRIVER=s3
BACKUP_S3_BUCKET=macartepro-sauvegardes
BACKUP_S3_REGION=fr-par
BACKUP_S3_ENDPOINT=https://s3.fr-par.scw.cloud
BACKUP_S3_ACCESS_KEY_ID=…
BACKUP_S3_SECRET_ACCESS_KEY=…

# Chiffrement : openssl rand -base64 32
BACKUP_ENCRYPTION_KEY=…

# Base vide dédiée aux essais de restauration (jamais la base de production).
BACKUP_RESTORE_TEST_DATABASE_URL=postgres://cartes:…@localhost:5432/cartes_essai_restauration

# Facultatif
BACKUP_ALERT_EMAIL=exploitation@exemple.fr
```

Les variables `BACKUP_S3_*` non renseignées reprennent celles du stockage des médias (`S3_*`). Seul `BACKUP_S3_BUCKET` est obligatoire.

Sans configuration, `BACKUP_DRIVER=local` écrit dans `./backups` (`BACKUP_DIR`). Ce mode protège contre une erreur de manipulation, **pas contre la perte du serveur** : l'administration l'indique en production. `BACKUP_DRIVER=off` désactive les sauvegardes.

Le serveur doit disposer de `pg_dump` et `pg_restore`, de la même version majeure que PostgreSQL ou plus récents : `sudo apt install postgresql-client-16`. `npm run doctor` vérifie tous ces points.

### Le bucket de sauvegarde

- Privé, avec des identifiants **propres aux sauvegardes**, différents de ceux du bucket des médias.
- Idéalement avec le verrouillage d'objets (« Object Lock ») ou le versionnage : une personne qui prendrait le contrôle du serveur ne pourrait alors pas effacer l'historique.
- Si vous activez une règle d'expiration automatique chez le fournisseur, elle doit être **plus longue** que la conservation réglée dans l'application. Sinon, des fichiers partagés entre sauvegardes pourraient disparaître.

### La clé de chiffrement

- Sans la clé, une sauvegarde chiffrée est **définitivement illisible**. Copiez-la dans un coffre-fort hors du serveur dès sa création.
- Le manifeste de chaque sauvegarde contient une empreinte courte de la clé (pas la clé). Une restauration avec une autre clé est refusée avec un message explicite.
- Changer de clé est possible : les nouvelles sauvegardes utilisent la nouvelle clé et recopient tous les fichiers. Conservez l'ancienne clé tant que les anciennes sauvegardes existent.

## Fonctionnement

À chaque passage de `npm run jobs` (toutes les 15 minutes), la tâche `backups` :

1. lance une sauvegarde si la dernière réussie date d'au moins la fréquence choisie ;
2. applique la politique de conservation ;
3. une fois par semaine, si `BACKUP_RESTORE_TEST_DATABASE_URL` est défini, restaure la dernière sauvegarde dans cette base et compare le nombre de lignes des tables principales ;
4. envoie une alerte (au plus une par jour) si aucune sauvegarde n'a réussi depuis trop longtemps.

Déroulement d'une sauvegarde :

1. Ouverture d'un **instantané PostgreSQL** : l'export, les comptages et la liste des médias reflètent exactement le même instant, même si des clients modifient leurs cartes pendant la sauvegarde.
2. `pg_dump` (format personnalisé, compressé), contrôle de lisibilité avec `pg_restore --list`, chiffrement, envoi.
3. Copie des fichiers de médias qui ne figurent pas encore dans la sauvegarde précédente (8 en parallèle).
4. Écriture du manifeste (contenu, tailles, empreintes SHA-256, comptages, version du schéma) et de l'index.
5. Relecture de tout ce qui vient d'être écrit et contrôle des empreintes.

Une seule opération de sauvegarde peut s'exécuter à la fois, même avec plusieurs serveurs (verrou PostgreSQL). En cas d'échec, les fichiers propres à la sauvegarde ratée sont effacés, l'erreur est affichée dans l'administration et un email est envoyé.

### Organisation dans la destination

```
index.json                              liste des sauvegardes
snapshots/<id>/manifest.json            contenu, empreintes, comptages
snapshots/<id>/database.dump.enc        export de la base (.dump si non chiffré)
media/<clé de stockage>.enc             fichiers, partagés entre sauvegardes
```

La destination se suffit à elle-même : on peut lister et restaurer les sauvegardes sans la base d'origine.

## Administration (`/admin/sauvegardes`)

Page réservée au rôle `admin`, avec double authentification :
- état : dernière sauvegarde réussie, prochaine échéance, dernier essai de restauration, points d'attention ;
- **Sauvegarder maintenant** : la sauvegarde tourne en arrière-plan et la page se met à jour automatiquement ;
- historique : taille, nombre de fichiers (copiés ou réutilisés), état de vérification ;
- par sauvegarde : **Vérifier** (relecture complète), **Tester la restauration** (si une base d'essai est configurée), **Supprimer** (avec confirmation ; la seule sauvegarde réussie ne peut pas être supprimée) ;
- politique : activation, fréquence, conservation, email d'alerte.

Toutes ces actions sont inscrites au journal d'audit. Le tableau de bord `/admin` affiche une alerte rouge si les sauvegardes sont en retard ou non configurées.

## Ligne de commande

```bash
npm run backup -- run [--full]           # sauvegarde immédiate (--full : recopie tous les fichiers)
npm run backup -- list                   # sauvegardes présentes dans la destination
npm run backup -- verify latest          # vérification complète (ou un identifiant)
npm run backup -- restore-test latest    # essai de restauration dans BACKUP_RESTORE_TEST_DATABASE_URL
npm run backup -- restore <id|latest> --target-db <url> [--media] [--replace-current]
```

## Restaurer

### Principe

On restaure **toujours dans une base neuve** d'abord, on vérifie, puis on fait pointer l'application dessus. Remplacer directement la base en service exige l'option `--replace-current` : sans elle, la commande refuse.

### Scénario 1 : perte totale du serveur

Sur un nouveau serveur, installé comme décrit dans [INSTALLATION.md](INSTALLATION.md) (sans `db:seed`) :

```bash
# 1. Remettre le .env sauvegardé hors du serveur (secrets, BACKUP_*, BACKUP_ENCRYPTION_KEY).
# 2. Créer une base vide.
sudo -u postgres createdb -O cartes cartes

# 3. Choisir la sauvegarde.
sudo -u macartepro npm run backup -- list

# 4. Restaurer la base et les fichiers (vers le stockage configuré par STORAGE_DRIVER).
sudo -u macartepro npm run backup -- restore latest --target-db "$DATABASE_URL" --media --replace-current

# 5. Appliquer les migrations éventuellement plus récentes que la sauvegarde, compiler, démarrer.
sudo -u macartepro npm run db:migrate
sudo -u macartepro npm run build
sudo systemctl restart macartepro
sudo -u macartepro npm run doctor
```

Ici `--replace-current` est attendu : la base cible est celle que l'application va utiliser. Comme elle est neuve, il n'y a rien à écraser.

### Scénario 2 : erreur de manipulation (carte, organisation ou fichiers supprimés par erreur)

1. Restaurer la sauvegarde d'avant l'erreur dans une **base séparée**, sans toucher à la production :
   ```bash
   sudo -u postgres createdb -O cartes cartes_recuperation
   npm run backup -- restore <id> --target-db postgres://cartes:…@localhost:5432/cartes_recuperation
   ```
2. Recopier dans la production uniquement les lignes nécessaires, par exemple avec `psql` ou `pg_dump --table` / `--data-only` sur la base de récupération.
3. Si des fichiers manquent, ils se trouvent dans `media/<clé de stockage>` de la destination. `--media` restaure tous les fichiers de la sauvegarde dans le stockage configuré, sans écraser la base.
4. Supprimer la base de récupération une fois terminé : elle contient des données personnelles.

### Scénario 3 : mise à jour ratée

```bash
git checkout <commit précédent> && npm ci && npm run build
npm run backup -- restore <id de la sauvegarde d'avant mise à jour> --target-db "$DATABASE_URL" --replace-current
sudo systemctl restart macartepro
```

### Après une restauration

- Les sessions encore valides dans la sauvegarde restent valides. Pour forcer une reconnexion générale, changez `BETTER_AUTH_SECRET`.
- Les paiements reçus par Stripe après la date de la sauvegarde sont rattrapés par la réconciliation des tâches planifiées. Vous pouvez aussi la lancer tout de suite depuis `/admin/organisations` (« Resynchroniser »).
- Les emails déjà envoyés après la date de la sauvegarde peuvent être renvoyés : la file d'envoi est restaurée telle qu'elle était à ce moment-là.

## Données personnelles

Les sauvegardes contiennent des données personnelles (comptes, prospects, statistiques). Il en découle trois règles :
- la conservation des sauvegardes doit figurer dans la politique de confidentialité. Une donnée effacée à la demande d'une personne reste présente dans les sauvegardes jusqu'à leur expiration (6 mois avec la politique par défaut) ;
- la destination doit être hébergée dans l'Union européenne, ou encadrée conformément au RGPD ;
- l'accès aux sauvegardes (bucket, clé) doit être réservé aux personnes chargées de l'exploitation.

## Limites connues

- L'export de la base est conservé en mémoire pendant la sauvegarde. C'est adapté jusqu'à quelques centaines de Mo de base compressée. Au-delà, prévoir un export en flux ou les sauvegardes natives de l'hébergeur de la base, en complément.
- Un fichier de média copié par une sauvegarde qui a ensuite échoué reste dans la destination. Il sera réutilisé, ou il restera orphelin si le média est supprimé entre-temps. C'est sans conséquence, hormis un peu d'espace.
- Le stockage S3 n'a pas été essayé avec un vrai bucket depuis l'environnement de développement. Seul le pilote local est testé automatiquement. Faites une sauvegarde puis un essai de restauration lors de la mise en service.

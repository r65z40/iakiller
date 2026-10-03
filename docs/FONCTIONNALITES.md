# Guide des fonctionnalités

Ce guide décrit tout ce que fait l'application, du point de vue de chaque type d'utilisateur. Pour l'installation, voir [INSTALLATION.md](INSTALLATION.md).

- [1. Vue d'ensemble](#1-vue-densemble)
- [2. Le visiteur d'une carte](#2-le-visiteur-dune-carte)
- [3. Le client : démarrer](#3-le-client--démarrer)
- [4. Créer et publier une carte](#4-créer-et-publier-une-carte)
- [5. QR code, partage et Wallet](#5-qr-code-partage-et-wallet)
- [6. Équipes et entreprises](#6-équipes-et-entreprises)
- [7. Prospects](#7-prospects)
- [8. Statistiques](#8-statistiques)
- [9. Abonnement et facturation](#9-abonnement-et-facturation)
- [10. Création accompagnée](#10-création-accompagnée)
- [11. Assistance, sécurité du compte et données](#11-assistance-sécurité-du-compte-et-données)
- [12. Administration de la plateforme](#12-administration-de-la-plateforme)
- [13. Site commercial et pages légales](#13-site-commercial-et-pages-légales)
- [14. Tâches automatiques](#14-tâches-automatiques)

---

## 1. Vue d'ensemble

L'application vend des **cartes de visite numériques** à des artisans, indépendants, commerciaux, TPE et PME. Chaque carte est une page web adaptée au téléphone, à l'adresse `https://domaine/entreprise/personne`, accompagnée d'un QR code permanent.

| Espace | Adresse | Pour qui |
|---|---|---|
| Site commercial | `/`, `/tarifs`, `/modeles`… | prospects de la plateforme |
| Cartes publiques | `/{entreprise}/{personne}` | visiteurs |
| Espace client | `/app` | clients (propriétaire, gestionnaires, collaborateurs) |
| Administration | `/admin` | équipe de la plateforme (admin, support) |

Le périmètre est volontairement limité aux cartes numériques : pas de carte physique, pas de NFC, pas de boutique.

---

## 2. Le visiteur d'une carte

Le visiteur arrive en scannant le QR code, en cliquant sur un lien ou après un partage par SMS ou messagerie. Aucun compte n'est nécessaire.

Ce qu'il peut faire :
- **Appeler, envoyer un email, un SMS ou un message WhatsApp** en un geste ;
- **Ajouter aux contacts** : téléchargement d'une fiche vCard (nom, fonction, société, téléphones, email, adresse, site, photo) ;
- **Ajouter à Apple Wallet ou Google Wallet** (si la plateforme est configurée pour) ;
- ouvrir l'itinéraire vers l'adresse, consulter le site, les réseaux sociaux, la galerie photo, les horaires et les services ;
- télécharger les documents PDF (plaquette, tarifs) ;
- regarder une vidéo YouTube ou Vimeo. Elle n'est chargée qu'après un clic, avec un avertissement, pour ne pas transmettre de données à ces services sans action du visiteur ;
- prendre rendez-vous (lien vers l'outil de réservation du professionnel) ;
- consulter ou laisser un avis, via des liens vers la fiche Google ou un autre service. Aucun avis n'est saisi ni affiché sur la carte ;
- **envoyer une demande** par le formulaire de contact. L'accord marketing est séparé et décoché par défaut.

Garanties pour le visiteur :
- pages légères et rapides : images adaptées à la taille de l'écran, aucun script tiers ;
- aucun cookie de suivi. La mesure d'audience, si elle est active, suit le régime choisi par la plateforme ; une bannière de consentement s'affiche si ce régime l'exige ;
- partage soigné : un aperçu illustré (nom, fonction, photo ou logo) s'affiche dans WhatsApp, LinkedIn ou les SMS ;
- une carte indisponible (désactivée, abonnement terminé) affiche une page neutre, sans aucune information sur la personne.

---

## 3. Le client : démarrer

1. **Inscription** sur `/inscription`, puis confirmation de l'adresse email (obligatoire).
2. **Création de l'organisation** (le nom de l'entreprise) : l'**essai gratuit de 7 jours** démarre, sans carte bancaire, avec jusqu'à 3 cartes. Un seul essai est accordé par personne : une deuxième organisation démarre sans essai.
3. Création de la première carte, puis publication.

Pendant l'essai, les cartes sont publiques. À la fin de l'essai sans abonnement, elles deviennent indisponibles, mais rien n'est supprimé : le client garde son compte, ses cartes et peut s'abonner à tout moment pour les remettre en ligne.

Le tableau de bord (`/app`) résume l'état de l'abonnement ou de l'essai, les cartes et le nombre de nouveaux prospects.

---

## 4. Créer et publier une carte

### Les cartes (`/app/cartes`)

Créer, dupliquer, archiver, désactiver temporairement, supprimer ou renommer l'adresse d'une carte. Un ancien lien continue de fonctionner : il redirige vers la nouvelle adresse.

### L'éditeur (`/app/cartes/{id}`)

- **Aperçu en direct**, en vue téléphone ou ordinateur. Cliquer sur un élément de l'aperçu ouvre ses réglages.
- **Identité** : prénom, nom, fonction, société, photo et logo (affichage au choix).
- **Bannière** : image, point focal, hauteur, flou et voile blanc réglables.
- **13 blocs** à ajouter, réordonner et masquer :

| Bloc | Contenu |
|---|---|
| Boutons de contact | appeler, email, ajouter aux contacts, Wallet |
| Coordonnées | mobile, fixe, email, WhatsApp, SMS, adresse avec itinéraire, site |
| Présentation | texte (gras, italique, listes) et étiquettes de savoir-faire |
| Liens | boutons avec titre, sous-titre et icône |
| Réseaux sociaux | LinkedIn, Instagram, Facebook, etc. |
| Galerie photo | jusqu'à 24 images avec légendes |
| Vidéo | YouTube ou Vimeo, chargée au clic |
| Documents PDF | jusqu'à 12 documents |
| Prise de rendez-vous | lien vers l'outil de réservation |
| Avis clients | liens « lire les avis » et « laisser un avis » |
| Horaires | jours et heures d'ouverture |
| Services | liste de prestations |
| Formulaire de contact | demandes reçues dans Prospects |

- **Réordonner** : à la souris, au doigt, au clavier ou avec les boutons monter et descendre.
- **Annuler et rétablir** chaque modification (Ctrl+Z, Ctrl+Maj+Z). Une suppression de bloc peut être annulée.
- **Recadrer une image** directement dans l'éditeur. L'original est conservé.
- **3 modèles** de présentation (Classique, Portrait, Entreprise), couleurs, police et arrondis.
- **Enregistrement automatique** avec état visible (« Enregistré », « Erreur, nouvelle tentative… »), reprise au retour du réseau et détection des modifications faites en même temps ailleurs.

### Brouillon, publication et versions

Les modifications restent dans un **brouillon** : les visiteurs voient la version publiée tant que le client n'a pas cliqué sur **Publier**. Chaque publication crée une version. Une liste de contrôle signale ce qui manque avant publication (nom, moyen de contact, liens invalides).

### Médias (`/app/medias`)

Images (JPEG, PNG, WebP, jusqu'à 8 Mo, ré-encodées et allégées automatiquement) et PDF (jusqu'à 15 Mo). Les fichiers sont vérifiés : type réel, contenu actif refusé (SVG refusé). L'espace utilisé est affiché par rapport au quota de la formule.

### Identité de marque (`/app/marque`)

Couleurs, police, logo et nom de société de l'entreprise, appliqués à toutes les cartes. Le propriétaire peut **verrouiller** des éléments (couleurs, police, logo…) : les collaborateurs ne peuvent plus les modifier, et un changement de charte s'applique immédiatement à toutes les cartes publiées.

---

- **Signature email** : depuis une carte, générez une signature d'email (trois styles) aux couleurs de la carte, à copier-coller dans Gmail, Outlook ou Apple Mail. Elle renvoie vers la carte et reste à jour. Écran : `/app/cartes/{id}/signature`.

## 5. QR code, partage et Wallet

- **QR code permanent** (`/r/{jeton}`) : il reste valable même si l'adresse de la carte change. Téléchargement en PNG (impression) et SVG (graphiste).
- **QR personnalisé** : couleur et logo au centre. L'application vérifie le contraste et **décode réellement** le QR à deux tailles avant d'accepter le style. Un QR illisible est refusé.
- **Image d'aperçu** générée automatiquement pour les partages.
- **Apple Wallet** (fichier `.pkpass`) et **Google Wallet** : le visiteur range la carte dans son téléphone. La configuration est décrite dans [WALLET.md](WALLET.md). Sans configuration, les boutons sont masqués.
- **Indexation** par les moteurs de recherche : désactivée par défaut, activable dans les paramètres.

---

## 6. Équipes et entreprises

### Rôles

| Rôle | Peut |
|---|---|
| Propriétaire | tout, y compris la facturation, la suppression de l'organisation et le transfert de propriété |
| Gestionnaire | gérer les cartes, les membres (sauf les autres gestionnaires), la marque, les prospects et les statistiques |
| Gestionnaire + facturation | idem, plus l'abonnement et les factures |
| Collaborateur | modifier et publier **ses** cartes, voir **ses** prospects et statistiques |

Le détail figure dans [PERMISSIONS.md](PERMISSIONS.md).

### Membres (`/app/membres`)

Invitation par email, valable 7 jours et réservée à l'adresse invitée. On peut changer le rôle d'un membre, le retirer (effet immédiat) et attribuer des cartes.

### Import en masse (`/app/cartes/import`)

Pour équiper une équipe en une fois, à partir d'un fichier CSV exporté d'un tableur. Colonnes reconnues : Prénom, Nom, Fonction, Email professionnel, Mobile, Téléphone fixe, Adresse, Site web, Profil LinkedIn.
- Un aperçu ligne par ligne s'affiche avant l'import, avec les erreurs et le contrôle du quota.
- Une carte est créée par ligne, aux couleurs de la marque.
- Option : inviter chaque salarié. Sa carte lui est attribuée automatiquement quand il accepte l'invitation.
- Option : publier directement.

---

## 7. Prospects

Les demandes envoyées par le formulaire d'une carte arrivent dans `/app/prospects`, avec une notification par email.
- Statuts « nouveau », « contacté » et « traité », plus des notes privées.
- Filtre par statut, export CSV.
- Protections : au moins un email ou un téléphone exigé, limitation des envois répétés, déduplication sur 24 h, pièges à robots.
- Un collaborateur ne voit que les prospects de ses cartes.

---

## 8. Statistiques

`/app/statistiques` : ouvertures, actions (appels, emails, vCard, liens, Wallet, etc.), formulaires envoyés, par période, par carte ou par membre. Répartitions par source (QR, campagne, direct), par appareil et par navigateur. Export CSV.

Les chiffres sont **honnêtes et expliqués** sur la page :
- un clic sur « Appeler » est une intention, pas un appel passé ;
- un passage par le lien du QR n'est pas la preuve d'un scan physique ;
- aucun « visiteur unique » n'est calculé ;
- les robots et les visites des membres de l'organisation sont exclus par défaut.

Le régime de collecte (sans cookie, ou avec consentement) est décrit dans [STATISTIQUES.md](STATISTIQUES.md).

---

## 9. Abonnement et facturation

`/app/abonnement`, réservé au propriétaire et aux gestionnaires avec facturation :
- formules mensuelles et annuelles (l'annuel revient moins cher par mois), avec quotas de cartes, de stockage et de membres ;
- paiement par **Stripe Checkout**. Aucun numéro de carte ne transite par l'application ;
- changement de formule avec **aperçu du prorata**. Une rétrogradation sous le nombre de cartes actives est refusée tant que le client n'a pas archivé les cartes en trop ;
- résiliation en fin de période, ou reprise d'une résiliation programmée ;
- portail Stripe pour le moyen de paiement, et liste des factures.

Comportement en cas d'impayé : les cartes restent en ligne pendant le **délai de grâce** (réglable), puis deviennent indisponibles jusqu'au paiement. À la fin d'un abonnement, les cartes deviennent indisponibles mais le contenu est conservé. L'ensemble des états est décrit dans [ETATS-ABONNEMENT.md](ETATS-ABONNEMENT.md).

---

## 10. Création accompagnée

Une prestation payante : l'équipe de la plateforme crée la carte pour le client.
1. Le client remplit un **brief** (personnes, textes, liens, couleurs, fichiers) et paie en ligne.
2. L'équipe réalise la carte dans l'organisation du client, grâce à un accès dédié, limité et journalisé.
3. Le client relit, demande des corrections (nombre inclus défini par l'offre) ou valide.
4. La carte est publiée après validation, sous réserve d'un abonnement ou d'un essai actif.

Le suivi se fait sur `/app/prestations`, avec messagerie et emails à chaque changement de statut. Les conditions (délais, corrections, remboursement) sont réglées dans l'administration et affichées sur `/creation-accompagnee`.

---

## 11. Assistance, sécurité du compte et données

- **Assistance** (`/app/assistance`) : tickets avec réponses par email. Le client voit les **accès d'assistance** ouverts par l'équipe (motif, durée de 24 h au plus) et peut les révoquer à tout moment.
- **Sécurité** (`/app/parametres`) : double authentification (TOTP), liste des sessions, déconnexion des autres appareils. Le mot de passe se change par « Mot de passe oublié » (les sessions ouvertes sont alors fermées).
- **Données** : export JSON complet de l'organisation, transfert de propriété, suppression de l'organisation.
- Mots de passe de 10 caractères au moins, limitation des tentatives de connexion, sessions révocables.

---

## 12. Administration de la plateforme

Accessible aux comptes `admin` ou `support`, **avec double authentification obligatoire**.

| Page | Contenu |
|---|---|
| Tableau de bord `/admin` | organisations, abonnements actifs, MRR indicatif, conversion des essais, résiliations, prestations, cartes publiées, webhooks en échec, points qui bloquent encore le lancement, alerte de sauvegarde |
| Organisations | recherche, détail, suspension ou rétablissement, suspension d'une carte, resynchronisation Stripe, ouverture d'un accès d'assistance |
| Utilisateurs | recherche, désactivation d'un compte (sessions fermées) |
| Réglages | marque et domaine, société, tarification (délai de grâce, remise annuelle, mention fiscale), durées de conservation, conditions de la création accompagnée, texte et validation juridique des 5 pages légales, régime de mesure d'audience |
| Plans et prestations | quotas, prix mensuels et annuels (avec prix annuel suggéré), identifiants Stripe, marqueur « démonstration » qui bloque la vente |
| Commandes de création | suivi, statuts, messages, création du brouillon chez le client |
| Support | tickets et réponses |
| Facturation | événements Stripe, échecs, export financier |
| **Sauvegardes** | état, lancement manuel, historique, vérification, essai de restauration, suppression, politique et alertes : voir [SAUVEGARDE.md](SAUVEGARDE.md) |
| Journal d'audit | toutes les actions sensibles, y compris celles de l'équipe en mode assistance |

Rôle `support` : consultation, suspension de cartes, réponses aux tickets, accès d'assistance et commandes de création. Les réglages, les prix, la facturation et les sauvegardes sont réservés au rôle `admin`.

---

## 13. Site commercial et pages légales

- Pages : accueil, fonctionnement, modèles (démonstrations interactives avec des données fictives), tarifs (lus depuis les plans réels), offre entreprise, création accompagnée, FAQ et contact.
- Pages légales : mentions légales, confidentialité, conditions du service, cookies et mesure d'audience, accord de sous-traitance. Elles sont générées à partir des informations de la société, ou remplacées par le texte définitif saisi dans l'administration. Un bandeau signale chaque page **non validée par un professionnel**.

---

## 14. Tâches automatiques

`npm run jobs` toutes les 15 minutes (installé par `deploy/systemd/macartepro-jobs.timer`) :

| Tâche | Rôle |
|---|---|
| Rappels d'essai | email 48 h avant la fin, puis à la fin de l'essai |
| Réconciliation Stripe | rattrape un webhook perdu |
| Emails en échec | nouvelles tentatives (5 au maximum) |
| Statistiques | agrégation, puis purge des données détaillées au-delà de la durée de conservation |
| Conservation | application des durées réglées (organisations inactives, prospects, journaux) |
| Nettoyage | invitations, sessions, vérifications et accès d'assistance expirés |
| Sauvegardes | sauvegarde quand elle est due, conservation, essai de restauration hebdomadaire, alertes |

Aucune de ces tâches ne conditionne la sécurité : la fin d'un essai ou d'un abonnement est appliquée en temps réel, à chaque affichage.

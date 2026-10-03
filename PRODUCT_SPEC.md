# Spécification produit

SaaS de cartes de visite numériques pour les professionnels français : artisans, indépendants, commerciaux, TPE et PME. Le nom de marque par défaut est « MaCartePro » (modifiable dans `/admin/reglages`, centralisé dans `src/lib/config.ts`).

## Personas
- **Artisan ou indépendant** : une carte, création rapide sur mobile ou sur ordinateur, QR code à imprimer.
- **Responsable d'une PME** : cartes de toute l'équipe, charte imposée, départs de salariés, statistiques comparées.
- **Collaborateur** : met à jour sa propre carte, sans toucher à la charte.
- **Visiteur** : ouvre la carte depuis un QR code ou un lien, appelle, enregistre le contact, envoie une demande.
- **Équipe plateforme** : support, création accompagnée, modération, facturation.

## Parcours livrés
| Parcours | Écrans |
|---|---|
| Découverte | `/`, `/fonctionnement`, `/modeles` (démonstrations interactives fictives), `/tarifs`, `/entreprise`, `/creation-accompagnee`, `/faq`, `/contact` |
| Inscription | `/inscription` → email de vérification → `/app/organisations/nouvelle` (démarrage de l'essai) |
| Connexion | `/connexion`, `/connexion/2fa`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` |
| Cartes | `/app/cartes` (création, duplication, archivage, désactivation, suppression), `/app/cartes/[id]` (éditeur) |
| Éditeur | Bibliothèque de 12 blocs, liste réordonnable (souris, tactile, clavier, boutons), aperçu en direct cliquable, panneau de propriétés, enregistrement automatique avec état visible, conflits, publication, versions, QR, adresse et attribution |
| Marque | `/app/marque` : couleurs, police, logo, société, verrous |
| Médias | `/app/medias` : envoi contrôlé, quota, suppression |
| Équipe | `/app/membres`, `/invitation/[token]` |
| Prospects | `/app/prospects` : statuts, notes privées, export CSV |
| Statistiques | `/app/statistiques` : période, carte, membre, visites internes, séries, répartitions, CSV, définitions |
| Facturation | `/app/abonnement` : formules mensuelles et annuelles, aperçu du prorata, résiliation et reprise, portail, factures |
| Prestation | `/app/prestations`, `/app/prestations/[id]` : brief, paiement, suivi, validation, corrections, remboursement |
| Assistance | `/app/assistance` : tickets, accès d'assistance visibles et révocables |
| Paramètres | `/app/parametres` : organisation, indexation, double authentification, sessions, export JSON, transfert, suppression |
| Public | `/{entreprise}/{personne}`, `/{…}/vcard`, `/r/{jeton}` (QR), `/m/{id}` (médias), `/indisponible`, pages légales |
| Plateforme | `/admin` et ses sous-pages : organisations, utilisateurs, plans, commandes, support, facturation, audit |

## Blocs de carte
Identité (prénom, nom, fonction, société, photo, logo) et bannière (image, point focal, hauteur, flou, voile), plus 12 blocs : boutons de contact, coordonnées (mobile, fixe, email, WhatsApp, SMS, adresse et itinéraire, site), présentation (texte riche limité et étiquettes), liens, réseaux, galerie, vidéo (YouTube ou Vimeo chargée au clic), documents PDF, rendez-vous (lien externe), horaires, services, formulaire de contact. « Ajouter aux contacts » génère la vCard.

## Modèles
« Classique », « Portrait » et « Entreprise » : des variantes de présentation d'un même document, disponibles dans toutes les formules.

## Hors périmètre
Cartes physiques, NFC, boutique, stock, expédition, domaines personnalisés, annuaire public, connexion à un CRM, campagnes marketing.

## Critères de validation et couverture
Voir IMPLEMENTATION_PLAN.md, section « Couverture des critères ».

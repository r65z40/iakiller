# Statistiques : collecte, calculs et limites

## Régime de collecte (proposition à valider)

Mode par défaut `ANALYTICS_MODE=minimal` :
- aucun cookie ni stockage sur l'appareil du visiteur pour la mesure ;
- un identifiant d'affichage aléatoire (`viewId`), généré dans la page et perdu à sa fermeture, sert à rattacher les clics à l'affichage ;
- aucune adresse IP stockée dans les statistiques : une empreinte à sel quotidien est gardée en mémoire seulement, pour limiter les abus ;
- dimensions : carte, organisation, horodatage, type d'action, cible technique (réseau, identifiant de bloc), source (`qr`, `campaign`, `direct`), paramètres UTM assainis, catégorie d'appareil, famille de navigateur, pays si l'hébergeur le fournit ;
- aucun contenu de message, aucune géolocalisation précise, aucun fingerprinting, aucun suivi entre clients.

`ANALYTICS_REQUIRE_CONSENT=true` : aucune mesure avant accord explicite, avec un bandeau « Accepter / Refuser » de même niveau. Le choix est mémorisé dans le navigateur et se retire en effaçant les données du site. `ANALYTICS_MODE=off` désactive toute collecte.

**Point juridique** : l'absence de cookie ne suffit pas à établir une dispense de consentement. L'exemption prévue par la CNIL pour la mesure d'audience est conditionnelle (finalité strictement limitée, données anonymisées ou agrégées, pas de recoupement, durées limitées). Le mode par défaut a été conçu dans cet esprit mais **doit être validé** au regard des recommandations CNIL en vigueur. Les sites cnil.fr n'ont pas pu être consultés depuis l'environnement de développement.

Les vidéos tierces (YouTube via youtube-nocookie.com, Vimeo avec `dnt=1`) ne sont chargées qu'après un clic, avec un avertissement.

## Validation côté serveur

Chaque événement doit concerner une carte publiée **et** accessible à cet instant. Une action doit appartenir à un `viewId` déjà enregistré pour la même carte. Le type d'événement est pris dans une liste fermée, chaque connexion est limitée à 120 événements par minute, et les clics identiques sont dédupliqués par l'index unique (`view_id, type, target`). « Formulaire envoyé » n'est enregistré que côté serveur, après un envoi réussi.

Exclusions par défaut : robots détectés par leur user-agent (sans garantie de filtrage parfait), visites des membres connectés de l'organisation et du personnel de la plateforme (`is_internal`, filtrable).

## Définitions affichées

- **Ouvertures mesurées** : événements `view` hors robots et visites internes.
- **Taux de clic** = ouvertures mesurées avec au moins une action ÷ ouvertures mesurées.
- **Taux de formulaire** = formulaires envoyés ÷ ouvertures mesurées.
- **Passages par le lien du QR** : ouvertures arrivées par `/r/{jeton}`. Ce n'est pas la preuve d'un scan physique.
- Un clic sur « Appeler » mesure une intention, pas un appel passé. Un téléchargement de vCard ne prouve pas l'ajout aux contacts.
- **Aucun « visiteur unique »** n'est calculé.
- Jours civils en Europe/Paris.

## Conservation

Les événements bruts sont gardés `ANALYTICS_RAW_RETENTION_DAYS` jours (proposition : 395), puis agrégés dans `analytics_daily` (carte, jour, type, source) et supprimés par `rollupAnalytics()`.

## Métriques plateforme (administration)

Organisations, abonnements payants actifs, MRR indicatif (prix des abonnements actifs, annuel ÷ 12, hors taxes, remises et prestations), conversion d'essai (essais démarrés sur la période qui ont un abonnement ÷ essais démarrés), résiliations effectives et programmées, prestations payées comptées à part, webhooks en échec.

# Permissions

Source unique : `src/lib/permissions.ts`. Le rôle provient **toujours** de l'appartenance relue en base (`lib/context.ts`) ; un identifiant d'organisation envoyé par le navigateur n'est jamais une preuve d'autorisation.

## Rôles d'organisation

| Permission | Propriétaire | Gestionnaire | Gestionnaire + facturation | Collaborateur |
|---|:-:|:-:|:-:|:-:|
| Voir l'organisation | ✅ | ✅ | ✅ | ✅ |
| Modifier nom, adresse, indexation | ✅ | | | |
| Supprimer l'organisation, transférer la propriété | ✅ | | | |
| Voir et gérer la facturation, commander une prestation | ✅ | | ✅ | |
| Voir et gérer les membres (hors propriétaire et autres gestionnaires) | ✅ | ✅ | ✅ | |
| Modifier l'identité de marque | ✅ | ✅ | ✅ | |
| Verrouiller des champs de marque | ✅ | | | |
| Créer, archiver, désactiver, renommer et attribuer des cartes | ✅ | ✅ | ✅ | |
| Modifier et publier une carte | toutes | toutes | toutes | assignées |
| Envoyer des médias | ✅ | ✅ | ✅ | ✅ |
| Prospects et statistiques | tout | tout | tout | cartes assignées |
| Journal d'audit de l'organisation | ✅ | | | |

Le retrait d'un membre prend effet à la requête suivante (pas de jeton longue durée contenant le rôle). Son attribution de cartes est supprimée et ses cartes peuvent être désactivées. « Se déconnecter de tous les autres appareils » révoque les sessions Better Auth.

## Rôles plateforme

Attribués uniquement par `npm run admin:create -- --email … --role admin|support`. L'accès à `/admin` exige la double authentification.

| Permission | admin | support |
|---|:-:|:-:|
| Consulter | ✅ | ✅ |
| Suspendre ou rétablir une organisation, désactiver un compte | ✅ | |
| Suspendre une carte | ✅ | ✅ |
| Plans, prix, prestations | ✅ | |
| Resynchroniser la facturation, voir les webhooks | ✅ | |
| Export financier | ✅ | |
| Répondre au support, ouvrir un accès d'assistance | ✅ | ✅ |
| Gérer les commandes de création accompagnée | ✅ | ✅ |
| Journal d'audit global | ✅ | |

## Accès d'assistance

Pas d'usurpation d'identité invisible. Le membre de l'équipe ouvre un accès motivé, limité à 24 h et notifié au propriétaire. Il entre dans l'espace client avec un bandeau « Mode assistance » et le rôle de gestionnaire, sans facturation. Chaque action est auditée avec `support_grant_id`. Le propriétaire voit l'accès dans « Assistance » et peut le révoquer.

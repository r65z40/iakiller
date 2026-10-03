# Audit et test d'intrusion de sécurité

Audit en boîte blanche de l'application (demandé par le propriétaire, réalisé en local, sans
cible tierce). Il combine une revue de code par domaine (autorisation et cloisonnement,
injection/XSS/SSRF, authentification/sessions/en-têtes, logique métier/facturation/déni de
service) et des tests dynamiques sur une version de production lancée en local.

- **Date** : octobre 2026
- **Périmètre** : code applicatif, configuration de déploiement (`deploy/`), dépendances.
- **Hors périmètre** : infrastructure d'hébergement réelle, Stripe en production, envoi SMTP réel.
- **Résultat global** : aucun accès entre organisations (IDOR), aucune injection SQL, de
  commande ou XSS stockée/réfléchie trouvée. Les points traités concernent surtout des
  limites de privilège (mode assistance, gestionnaires), une fuite de contenu masqué, des
  protections d'abus et des en-têtes de sécurité. **Tous les points de gravité moyenne et
  supérieure ont été corrigés**, avec des tests de non-régression.

Les tests ajoutés : `tests/unit/security.test.ts` et `tests/integration/security.test.ts`
(11 tests), en plus des 101 existants (112 au total), plus la vérification navigateur de la
politique de sécurité du contenu.

## 1. Ce qui a été corrigé

### Autorisation et cloisonnement

| # | Gravité | Problème | Correction |
|---|---|---|---|
| A1 | Élevée (interne) | En **mode assistance**, un membre de l'équipe pouvait s'inviter lui-même comme gestionnaire et obtenir un accès durable, survivant à l'expiration de l'accès d'assistance. | La gestion des membres (inviter, révoquer, changer de rôle, retirer) est désormais **interdite en mode assistance** (`assertNotSupportMode`, `orgs/members.ts`). |
| A2 | Moyenne | Un **gestionnaire** pouvait rétrograder puis retirer un autre gestionnaire, contournant la règle « seul le propriétaire gère les gestionnaires ». | `canAssignRole` refuse à un gestionnaire de viser ou de créer un autre gestionnaire (`permissions.ts`). |
| A3 | Moyenne (fuite) | Les **blocs masqués** et la **photo/logo masqués** étaient sérialisés dans la page publique, et leurs fichiers servis par `/m/{id}`. | Projection publique (`publicDocument`) appliquée avant que le document ne quitte le serveur ; `/m/{id}` ne sert un média que s'il est référencé par cette projection (`cards/public.ts`, `document.ts`). Corrige aussi les versions déjà publiées, sans migration. |
| A4 | Moyenne | L'accès lié à une **création accompagnée** durait 30 jours, sans prévenir le propriétaire (la politique prévoit 24 h et une notification pour l'assistance). | Durée ramenée à **7 jours** (renouvelable par phase) et **email au propriétaire** à l'ouverture (`services/orders.ts`). |

### Injection, encodage, fichiers

| # | Gravité | Problème | Correction |
|---|---|---|---|
| B1 | Moyenne | **Pollution de prototype** via l'opérateur `in` : un visiteur anonyme pouvait envoyer un type d'événement `__proto__` et faire planter (500) la page de statistiques de toute une organisation. | `Object.hasOwn` partout où une entrée utilisateur servait de clé (mesure d'audience, police de marque, verrous, pages légales, import CSV, libellés de statistiques). |
| B2 | Faible | Une police de marque nommée `constructor`/`toString` pouvait bloquer l'édition des cartes. | Idem (`Object.hasOwn(FONTS, …)`). |
| B3 | Faible | `safeInternalPath` laissait passer une tabulation, permettant en théorie une redirection externe depuis la page 2FA. | Refus de tous les caractères de contrôle et antislash, puis vérification que l'URL résolue reste sur notre origine (`validation/urls.ts`). |
| B4 | Faible | Le **nom de téléchargement** conservait l'extension choisie par le client (polyglottes PDF/HTA) et des caractères bidirectionnels. | L'extension est imposée d'après le type réel, les caractères de contrôle et de réécriture sont retirés (`media/respond.ts`). |

### Authentification, sessions, en-têtes

| # | Gravité | Problème | Correction |
|---|---|---|---|
| C1 | Moyenne | Une session ouverte **avec le seul mot de passe, avant l'activation de la 2FA**, gardait ensuite les droits d'administration. | Fermeture des autres sessions à l'activation de la 2FA (`revokeOtherSessions`) et suppression des sessions lors de l'attribution d'un rôle plateforme (`create-admin.ts`). |
| C2 | Moyenne | Le **limiteur de débit** faisait confiance à la première valeur de `X-Forwarded-For`, usurpable avec la configuration nginx fournie : toutes les limites applicatives étaient contournables, avec une fuite mémoire associée. | `clientIp` préfère `X-Real-IP` puis la **dernière** valeur de `X-Forwarded-For` ; nginx ne propage plus le `X-Forwarded-For` du client ; `trustedProxies` réglé pour Better Auth ; le nettoyage du limiteur respecte la fenêtre de chaque entrée et borne la table (`security/rate-limit.ts`, `auth.ts`, `deploy/nginx.conf`). |
| C3 | Faible | Pas de **Content-Security-Policy** ni de **HSTS**. | CSP stricte (sans `unsafe-eval`, `frame-ancestors 'none'`, iframes limitées à YouTube/Vimeo), HSTS et `Cross-Origin-Opener-Policy` ajoutés (`next.config.ts`). Vérifié sans violation au navigateur. |
| C4 | Faible | Le drapeau `Secure` des cookies et l'empreinte d'IP dépendaient d'un réglage éditable, ou retombaient silencieusement sur un secret public. | `useSecureCookies` déduit de l'URL technique ou forcé en production ; l'empreinte d'IP exige un secret en production (`auth.ts`, `rate-limit.ts`). |

### Logique métier, facturation, abus

| # | Gravité | Problème | Correction |
|---|---|---|---|
| D1 | Élevée | L'horodatage de **prorata** d'un changement de formule venait du client : possibilité de se forger un crédit en facturant une période presque entière comme inutilisée. | L'horodatage est fixé par le serveur (`billing/service.ts`, `changePlan`). |
| D2 | Moyenne | Le **quota de membres** n'était pas revérifié à l'acceptation d'une invitation (dépassement après rétrogradation). | Revérification sous verrou d'organisation dans `acceptInvitation` (`orgs/members.ts`). |
| D3 | Moyenne | Les **notifications de prospect** pouvaient inonder les boîtes mail d'une organisation. | Plafond de notifications par carte (le prospect reste enregistré) (`leads/service.ts`). |
| D4 | Faible-moyenne | Une **clé Stripe de test en production** aurait donné de vrais droits avec une carte de test. | Point bloquant ajouté à la liste « avant lancement » (`launchBlockers`). |
| D5 | Faible | La **rotation de la clé de chiffrement** des sauvegardes écrasait les fichiers d'anciennes sauvegardes (illisibles ensuite). | L'empreinte de clé fait partie du chemin de stockage (`backup/service.ts`). |
| D6 | Faible | Les corps d'emails (liens de confirmation, réinitialisation, invitation) restaient indéfiniment en base. | Purge des emails envoyés de plus de 30 jours dans les tâches planifiées (`jobs.ts`). |

### Dépendances

- `joi` (pollution de prototype) : corrigé via `overrides` vers 17.13.8.
- `node-forge` (vérification de signature) : aucun correctif publié en amont ; **non atteignable**
  dans l'application (utilisé uniquement pour *signer* les passes Wallet, pas pour vérifier).
  À suivre pour mise à jour dès qu'un correctif paraît.
- `esbuild`/`drizzle-kit` : dépendances de **développement** uniquement (génération de
  migrations), jamais exécutées par le serveur de production.

## 2. Vérifié et jugé sain (extraits)

- **Cloisonnement entre organisations** : toutes les requêtes métier filtrent par
  `organization_id` issu de la session et de l'appartenance relue en base. Le cookie
  `active_org` n'est qu'une préférence ; le forger redirige vers la création d'organisation.
- **Droits recalculés à chaque requête** depuis l'état Stripe que le serveur relit lui-même :
  une redirection de succès falsifiée n'accorde aucun droit ; les webhooks sont vérifiés par
  signature et idempotents.
- **Prix** toujours lus en base par identifiant ; jamais de montant fourni par le client.
- **Mesure d'audience et prospects** : origine vérifiée (cross-origin refusé, confirmé en
  base), jeton de formulaire signé (HMAC, comparaison à temps constant), taille des corps
  bornée.
- **Médias** : type réel détecté par signature, SVG refusé, images ré-encodées et bornées en
  pixels, clés de stockage aléatoires, chemins à l'abri de la traversée, réponses en `sandbox`.
- **Administration** : chaque page et action exige le rôle et la double authentification ;
  `/dev/emails` est désactivé en production.
- **Jetons** : identifiants ~119 bits, jetons publics 144 bits, invitations 192 bits stockées
  en empreinte, à usage unique et liées à l'adresse invitée.

## 3. Recommandations de suivi (non bloquantes)

Ces points d'amélioration (abus/disponibilité, risque faible) restent à planifier :

1. **Signer le `viewId`** des mesures d'audience côté serveur (comme le jeton de formulaire)
   pour empêcher la pollution volontaire des statistiques, et plafonner les événements par
   carte. Aujourd'hui seule la cohérence et la limitation de débit protègent ces compteurs.
2. **Plafonner les invitations** par organisation et par jour en base (une boucle
   inviter/révoquer reste possible), et exiger un essai ou un abonnement actif pour inviter.
3. **Mettre en cache** les rendus d'image non authentifiés coûteux (`/m/{id}?format=png`,
   image d'aperçu, passe Wallet, vCard) et les limiter par IP, pour réduire la surface de
   déni de service sans CDN.
4. **Conservation** : purger aussi les organisations sans abonnement ni essai (champ
   `trialEndsAt` nul), et limiter le stockage de ces organisations.
5. **Intégrité des paiements de prestation** : gérer les remboursements et litiges Stripe,
   et rendre le marquage « payé » strictement idempotent par statut.
6. **Accès de création accompagnée** limité à la seule carte concernée (accès par carte),
   plutôt qu'un accès gestionnaire à toute l'organisation.
7. Envisager un **contrôle des mots de passe compromis** (plugin « have I been pwned ») et un
   en-tête **CSP à nonce** pour retirer `'unsafe-inline'` des scripts.

## 4. Méthode de test dynamique

Tests menés sur une version de production locale (`next build && next start`, `NODE_ENV=production`) :
énumération de comptes, limitation de débit (y compris rotation d'IP usurpée), IDOR entre deux
comptes réels, forge du cookie `active_org`, accès administration sans rôle, CSRF/origine des
routes publiques (confirmée en base), traversée de chemin, redirections, et contrôle des
en-têtes de sécurité et de l'absence de violation CSP au navigateur.

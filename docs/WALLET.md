# Apple Wallet et Google Wallet

Les boutons « Ajouter à Apple Wallet » et « Ajouter à Google Wallet » apparaissent dans le bloc « Boutons de contact » **uniquement** si la plateforme est configurée, et chaque carte peut les masquer. Le pass contient le nom, la fonction, la société, le mobile et l'email, plus un QR code qui pointe vers le lien stable `/r/{jeton}`. Les mêmes contrôles d'accès que la page publique s'appliquent : une carte indisponible ne produit aucun pass.

## Apple Wallet

1. Adhérer au programme Apple Developer (payant, au nom de la société).
2. Dans « Certificates, Identifiers & Profiles », créer un identifiant **Pass Type ID** (ex. `pass.fr.votre-domaine.carte`).
3. Générer le certificat associé, l'exporter (.p12), puis le convertir :
   ```bash
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -legacy
   ```
4. Télécharger le certificat intermédiaire **Apple WWDR (G4)** et le convertir en PEM.
5. Renseigner `APPLE_WALLET_PASS_TYPE_ID`, `APPLE_WALLET_TEAM_ID`, `APPLE_WALLET_SIGNER_CERT`, `APPLE_WALLET_SIGNER_KEY` (et la phrase secrète), `APPLE_WALLET_WWDR`. Les variantes `_B64` acceptent le contenu encodé en base64.
6. Tester sur un iPhone : ouvrir une carte publiée et toucher « Ajouter à Apple Wallet ».

Le pass n'est pas mis à jour automatiquement après modification de la carte (pas de service web PassKit dans cette version) : le QR mène toujours à la carte à jour.

## Google Wallet

1. Créer un compte émetteur dans la **Google Pay & Wallet Console** et noter l'**Issuer ID**.
2. Dans Google Cloud, activer l'API Google Wallet, créer un **compte de service** et une clé JSON, puis autoriser ce compte de service dans la console Wallet.
3. Renseigner `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_PRIVATE_KEY` (champ `private_key` du JSON).
4. Le domaine public doit être en HTTPS (origine déclarée dans le jeton, logo récupéré par Google via `/m/{id}?format=png`).
5. Tant que le compte émetteur est en mode démo, seuls les comptes de test déclarés peuvent enregistrer le pass.

## Marques

Respecter les recommandations d'Apple et de Google pour les boutons officiels « Add to Apple Wallet » et « Enregistrer dans Google Wallet » avant la mise en production. Les boutons textuels actuels sont provisoires.

## Vérifications automatisées

`tests/integration/wallet.test.ts` génère une chaîne de certificats factice avec openssl, vérifie que le `.pkpass` contient `pass.json`, `manifest.json`, `signature` et les icônes, et contrôle que le lien Google est un jeton RS256 dont la signature se vérifie. Ces tests **ne remplacent pas** un essai sur un vrai téléphone avec de vrais identifiants.

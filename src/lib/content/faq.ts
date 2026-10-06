/** Questions fréquentes, partagées par la page /faq et l'aperçu de la page d'accueil. */
export const FAQ: readonly (readonly [string, string])[] = [
  ["Faut-il une carte bancaire pour l'essai ?", "Non. L'essai de 7 jours démarre à la création de votre organisation et permet jusqu'à 3 cartes. Rien n'est facturé automatiquement à la fin."],
  ["Que se passe-t-il à la fin de l'essai sans abonnement ?", "Vos cartes deviennent indisponibles pour les visiteurs (le QR code affiche une page d'indisponibilité). Votre compte et vos contenus restent accessibles pour souscrire ; ils ne sont pas supprimés automatiquement à cette date."],
  ["Le QR code change-t-il si je modifie ma carte ?", "Non. Il pointe vers un lien permanent qui mène toujours à l'adresse actuelle de la carte, même si vous la renommez."],
  ["Puis-je l'utiliser sur mon téléphone ?", "Oui. La création comme la consultation fonctionnent sur mobile. Les visiteurs peuvent aussi ajouter votre carte à Apple Wallet ou Google Wallet."],
  ["Et si je résilie ?", "Vos cartes restent en ligne jusqu'à la fin de la période déjà payée, puis deviennent indisponibles. Il n'y a pas de maintien gratuit automatique."],
  ["Vendez-vous des cartes physiques ou NFC ?", "Non, uniquement des cartes numériques. Vous pouvez imprimer vous-même le QR code sur vos supports."],
  ["Puis-je utiliser mon propre nom de domaine ?", "Pas dans cette version : les cartes sont publiées à l'adresse du service, sous la forme /entreprise/personne."],
  ["Mes cartes apparaissent-elles sur Google ?", "Par défaut, non : l'indexation est désactivée. Le propriétaire de l'organisation peut l'activer. Aucun annuaire public des cartes n'est proposé."],
  ["Les statistiques sont-elles exactes ?", "Ce sont des mesures avec des limites, expliquées dans votre espace : un clic « Appeler » mesure une intention, pas un appel passé ; les robots sont filtrés sans garantie de perfection ; aucun « visiteur unique » n'est calculé."],
  ["Qui voit les demandes envoyées par le formulaire ?", "Uniquement les membres autorisés de votre organisation. Le visiteur est informé de la destination de ses données ; l'accord marketing est séparé et décoché par défaut."],
  ["C'est juste une carte de visite ?", "Non. C'est aussi un mini-site vitrine multi-pages, un CRM pour suivre vos prospects et des relances automatiques. La carte et ses outils (QR, statistiques, formulaire, CRM) sont inclus dès la formule Solo ; le mini-site vitrine et les relances automatiques sont inclus à partir du Pro — et débloqués pendant tout l'essai."],
  ["Qu'est-ce que le mini-site vitrine ?", "Un vrai site multi-pages (Accueil, Services, Réalisations, Contact) construit avec les mêmes blocs que vos cartes, en glisser-déposer, à partir d'un modèle métier. Thème, logo et coordonnées sont partagés : aucune double saisie. Son formulaire alimente directement votre CRM."],
  ["Comment fonctionnent le CRM et les relances ?", "Chaque demande devient un prospect que vous faites avancer dans un pipeline (Nouveau → … → Gagné), avec tâches et notes. Les relances automatiques envoient un email ou créent une tâche de rappel au bon moment, une seule fois par prospect."],
  ["Comment se passe la création accompagnée ?", "Vous envoyez un brief et réglez la prestation ; nous préparons un brouillon que vous validez avant publication. La prestation n'inclut pas l'abonnement."],
] as const;

/** Sélection mise en avant sur la page d'accueil. */
export const HOME_FAQ = FAQ.slice(0, 5);

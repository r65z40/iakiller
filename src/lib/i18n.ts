export type Locale = "en" | "fr";

const translations = {
  nav: {
    home: { en: "Home", fr: "Accueil" },
    tool: { en: "Tool", fr: "Outil" },
    getStarted: { en: "Get Started", fr: "Commencer" },
  },

  hero: {
    badge: {
      en: "100% free — No sign-up required",
      fr: "100% gratuit — Aucune inscription requise",
    },
    titleLine1: {
      en: "Make your AI content",
      fr: "Rendez votre contenu IA",
    },
    titleHighlight: {
      en: "undetectable",
      fr: "indétectable",
    },
    description: {
      en: "Our proprietary algorithm erases all invisible signatures left by AI. Your content becomes 100% authentic in the eyes of any platform.",
      fr: "Notre algorithme propriétaire efface toutes les signatures invisibles laissées par les IA. Votre contenu redevient 100% authentique aux yeux de n'importe quelle plateforme.",
    },
    cta: { en: "Launch tool", fr: "Lancer l'outil" },
    learnMore: { en: "Learn more", fr: "En savoir plus" },
    statFree: { en: "Free", fr: "Gratuit" },
    statInstant: { en: "Instant", fr: "Instant" },
    statInstantSub: { en: "Processing", fr: "Traitement" },
    statPrivate: { en: "Private", fr: "Privé" },
    statPrivateSub: { en: "No storage", fr: "Aucun stockage" },
  },

  features: {
    title: {
      en: "Three content types, ",
      fr: "Trois types de contenu, ",
    },
    titleHighlight: {
      en: "one tool",
      fr: "un seul outil",
    },
    subtitle: {
      en: "No matter which AI was used, our technology adapts and neutralizes all fingerprints in seconds.",
      fr: "Peu importe l'IA utilisée, notre technologie s'adapte et neutralise toutes les empreintes en quelques secondes.",
    },
    image: {
      title: { en: "Images", fr: "Images" },
      description: {
        en: "Our algorithm analyzes and rebuilds your image pixel by pixel. All invisible signatures are erased and replaced with an authentic fingerprint.",
        fr: "Notre algorithme analyse et reconstruit votre image pixel par pixel. Toutes les signatures invisibles sont effacées et remplacées par une empreinte authentique.",
      },
    },
    text: {
      title: { en: "Text", fr: "Textes" },
      description: {
        en: "Our linguistic engine detects artificial writing patterns and transforms them into natural language. The result passes all detectors.",
        fr: "Notre moteur linguistique détecte les schémas d'écriture artificiels et les transforme en langage naturel. Le résultat passe tous les détecteurs.",
      },
    },
    video: {
      title: { en: "Videos", fr: "Vidéos" },
      description: {
        en: "Complete reconstruction of the video file. Every frame is reprocessed to eliminate any trace of artificial origin.",
        fr: "Reconstruction complète du fichier vidéo. Chaque frame est retraitée pour éliminer toute trace d'origine artificielle.",
      },
    },
  },

  steps: {
    title: { en: "As easy as ", fr: "Simple comme " },
    s1: {
      title: { en: "Upload", fr: "Uploadez" },
      desc: {
        en: "Drag your file or paste your text",
        fr: "Glissez votre fichier ou collez votre texte",
      },
    },
    s2: {
      title: { en: "Process", fr: "Traitez" },
      desc: {
        en: "Our algorithms clean all AI traces",
        fr: "Nos algorithmes nettoient toutes les traces IA",
      },
    },
    s3: {
      title: { en: "Download", fr: "Téléchargez" },
      desc: {
        en: "Get your cleaned file back",
        fr: "Récupérez votre fichier nettoyé",
      },
    },
  },

  cta: {
    title: {
      en: "Ready to make your content ",
      fr: "Prêt à rendre votre contenu ",
    },
    titleHighlight: {
      en: "undetectable",
      fr: "indétectable",
    },
    subtitle: {
      en: "No sign-up, no payment. Upload and download.",
      fr: "Aucune inscription, aucun paiement. Uploadez et téléchargez.",
    },
    button: { en: "Start now", fr: "Commencer maintenant" },
  },

  footer: {
    copy: {
      en: "IAKiller. Free content cleaning tool.",
      fr: "IAKiller. Outil gratuit de nettoyage de contenu.",
    },
  },

  tool: {
    title: { en: "The ", fr: "La " },
    titleHighlight: { en: "magic", fr: "magie" },
    titleEnd: { en: " happens here", fr: " opère ici" },
    subtitle: {
      en: "Choose your content type and let our algorithm do the rest",
      fr: "Choisissez votre type de contenu et laissez notre algorithme faire le reste",
    },
    tabImage: { en: "Image", fr: "Image" },
    tabText: { en: "Text", fr: "Texte" },
    tabVideo: { en: "Video", fr: "Vidéo" },
  },

  image: {
    protectionLevel: { en: "Protection level", fr: "Niveau de protection" },
    intensity: { en: "Intensity", fr: "Intensité" },
    maximum: { en: "Maximum", fr: "Maximum" },
    optimal: { en: "Optimal", fr: "Optimal" },
    light: { en: "Light", fr: "Léger" },
    maxProtection: { en: "Maximum protection", fr: "Protection maximale" },
    maxQuality: { en: "Maximum quality", fr: "Qualité maximale" },
    outputFormat: { en: "Output format", fr: "Format de sortie" },
    dropzone: {
      en: "Drag an image here or click to browse",
      fr: "Glissez une image ici ou cliquez pour parcourir",
    },
    dropzoneSub: { en: "PNG, JPG, WebP — Max 20 MB", fr: "PNG, JPG, WebP — Max 20 MB" },
    selectImage: { en: "Please select an image", fr: "Veuillez sélectionner une image" },
    processing: { en: "Processing...", fr: "Traitement en cours..." },
    cleanBtn: { en: "Clean image", fr: "Nettoyer l'image" },
    success: { en: "Image cleaned successfully", fr: "Image nettoyée avec succès" },
    signaturesErased: { en: "AI signatures:", fr: "Signatures IA :" },
    signaturesVal: { en: "Erased", fr: "Effacées" },
    fingerprintRebuilt: { en: "Digital fingerprint:", fr: "Empreinte numérique :" },
    fingerprintVal: { en: "Rebuilt", fr: "Reconstruite" },
    authenticityRestored: { en: "Authenticity:", fr: "Authenticité :" },
    authenticityVal: { en: "Restored", fr: "Restaurée" },
    detectionNeutralized: { en: "Detection:", fr: "Détection :" },
    detectionVal: { en: "Neutralized", fr: "Neutralisée" },
    download: { en: "Download cleaned image", fr: "Télécharger l'image nettoyée" },
    processAnother: { en: "Process another image", fr: "Traiter une autre image" },
    before: { en: "Before", fr: "Avant" },
    after: { en: "After", fr: "Après" },
  },

  text: {
    config: { en: "Configuration", fr: "Configuration" },
    textLanguage: { en: "Text language", fr: "Langue du texte" },
    autoDetect: { en: "Auto-detect", fr: "Auto-détection" },
    pasteLabel: { en: "Paste your text to process", fr: "Collez votre texte à traiter" },
    placeholder: { en: "Paste your text here...", fr: "Collez ici le texte à traiter..." },
    characters: { en: "characters", fr: "caractères" },
    processing: { en: "Processing...", fr: "Traitement en cours..." },
    cleanBtn: { en: "Clean text", fr: "Nettoyer le texte" },
    success: { en: "Text cleaned", fr: "Texte nettoyé" },
    copy: { en: "Copy", fr: "Copier" },
    copied: { en: "Copied!", fr: "Copié !" },
    processAnother: { en: "Process another text", fr: "Traiter un autre texte" },
  },

  video: {
    dropzone: {
      en: "Drag a video here or click to browse",
      fr: "Glissez une vidéo ici ou cliquez pour parcourir",
    },
    dropzoneSub: { en: "MP4, MOV, AVI — Max 100 MB", fr: "MP4, MOV, AVI — Max 100 MB" },
    selectVideo: { en: "Please select a video", fr: "Veuillez sélectionner une vidéo" },
    tooLarge: {
      en: "Video must not exceed 100 MB",
      fr: "La vidéo ne doit pas dépasser 100 MB",
    },
    processing: {
      en: "Processing (may take a few minutes)...",
      fr: "Traitement en cours (peut prendre quelques minutes)...",
    },
    cleanBtn: { en: "Clean video", fr: "Nettoyer la vidéo" },
    success: { en: "Video cleaned successfully", fr: "Vidéo nettoyée avec succès" },
    signaturesErased: { en: "AI signatures:", fr: "Signatures IA :" },
    signaturesVal: { en: "Erased", fr: "Effacées" },
    fileRebuilt: { en: "File:", fr: "Fichier :" },
    fileVal: { en: "Rebuilt", fr: "Reconstruit" },
    download: { en: "Download cleaned video", fr: "Télécharger la vidéo nettoyée" },
    processAnother: { en: "Process another video", fr: "Traiter une autre vidéo" },
  },
  limits: {
    remaining: { en: "processings remaining today", fr: "traitements restants aujourd'hui" },
    unlimited: { en: "Unlimited", fr: "Illimité" },
    limitReached: { en: "Daily limit reached", fr: "Limite journalière atteinte" },
    limitDesc: {
      en: "You have used all your free processings for today. Come back tomorrow or activate a premium key.",
      fr: "Vous avez utilisé tous vos traitements gratuits pour aujourd'hui. Revenez demain ou activez une clé premium.",
    },
    premiumBadge: { en: "Premium", fr: "Premium" },
    freeBadge: { en: "Free", fr: "Gratuit" },
    activateKey: { en: "Activate premium key", fr: "Activer une clé premium" },
    keyPlaceholder: { en: "XXXX-XXXX-XXXX-XXXX", fr: "XXXX-XXXX-XXXX-XXXX" },
    activate: { en: "Activate", fr: "Activer" },
    invalidKey: { en: "Invalid or expired key", fr: "Clé invalide ou expirée" },
    activated: { en: "Premium activated!", fr: "Premium activé !" },
    noAds: { en: "No ads", fr: "Sans publicité" },
    moreProcessings: { en: "More processings per day", fr: "Plus de traitements par jour" },
    premiumFeatures: { en: "Premium advantages", fr: "Avantages premium" },
  },

  popup: {
    close: { en: "Close", fr: "Fermer" },
    ad: { en: "Advertisement", fr: "Publicité" },
    skipIn: { en: "Skip in", fr: "Passer dans" },
    skip: { en: "Skip", fr: "Passer" },
  },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(
  section: string,
  key: string,
  locale: Locale
): string {
  const sec = translations[section as keyof typeof translations] as Record<string, unknown> | undefined;
  if (!sec) return key;

  const entry = sec[key] as Record<Locale, string> | undefined;
  if (!entry) return key;

  return entry[locale] || entry["en"] || key;
}

export function ts(
  section: string,
  locale: Locale
): Record<string, string> {
  const sec = translations[section as keyof typeof translations] as Record<string, unknown> | undefined;
  if (!sec) return {};

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(sec)) {
    if (typeof val === "object" && val !== null && "en" in val) {
      result[key] = (val as Record<Locale, string>)[locale] || (val as Record<Locale, string>)["en"];
    }
  }
  return result;
}

export default translations;

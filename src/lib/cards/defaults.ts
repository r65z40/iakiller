import { blockId } from "./client-ids";
import {
  CURRENT_SCHEMA_VERSION,
  type BlockType,
  type CardBlock,
  type CardDocument,
  type CardTheme,
  type TemplateId,
} from "./document";

export const BLOCK_LIBRARY: { type: BlockType; label: string; description: string }[] = [
  { type: "actions", label: "Boutons de contact", description: "Appeler, envoyer un email, ajouter aux contacts" },
  { type: "contacts", label: "Coordonnées", description: "Mobile, fixe, email, WhatsApp, SMS, adresse, site" },
  { type: "about", label: "Présentation", description: "Texte court et étiquettes de savoir-faire" },
  { type: "links", label: "Liens", description: "Boutons avec titre, sous-titre et icône" },
  { type: "social", label: "Réseaux sociaux", description: "LinkedIn, Instagram, Facebook…" },
  { type: "gallery", label: "Galerie photo", description: "Images avec légendes facultatives" },
  { type: "video", label: "Vidéo", description: "YouTube ou Vimeo, chargée au clic" },
  { type: "documents", label: "Documents PDF", description: "Plaquette, tarifs, fiche produit" },
  { type: "appointment", label: "Prise de rendez-vous", description: "Lien vers votre outil de réservation" },
  { type: "reviews", label: "Avis clients", description: "Liens vers votre fiche d'avis (Google…)" },
  { type: "hours", label: "Horaires", description: "Jours et heures d'ouverture" },
  { type: "services", label: "Services", description: "Liste de prestations" },
  { type: "leadForm", label: "Formulaire de contact", description: "Recevez des demandes de prospects" },
];

export function blockLabel(type: BlockType): string {
  return BLOCK_LIBRARY.find((b) => b.type === type)?.label ?? type;
}

export function newBlock(type: BlockType): CardBlock {
  const base = { id: blockId(), hidden: false };
  switch (type) {
    case "actions":
      return { ...base, type, showCall: true, showEmail: true, showVcard: true, callLabel: "Appeler", emailLabel: "Envoyer un mail", vcardLabel: "Ajouter aux contacts" };
    case "contacts":
      return { ...base, type, title: "Coordonnées", items: [] };
    case "about":
      return { ...base, type, title: "Présentation", text: "", tags: [] };
    case "links":
      return { ...base, type, title: "", items: [] };
    case "social":
      return { ...base, type, title: "Réseaux", items: [] };
    case "gallery":
      return { ...base, type, title: "En images", items: [] };
    case "video":
      return { ...base, type, title: "Vidéo", provider: null, videoId: "" };
    case "documents":
      return { ...base, type, title: "Documents", items: [] };
    case "reviews":
      return { ...base, type, title: "Avis clients", platform: "google", platformName: "", readUrl: "", writeUrl: "", intro: "Votre avis nous aide à progresser." };
    case "appointment":
      return { ...base, type, title: "Rendez-vous", label: "Prendre rendez-vous", url: "", note: "" };
    case "hours":
      return {
        ...base,
        type,
        title: "Horaires",
        rows: [
          { id: blockId(), day: "Lundi – vendredi", value: "9 h – 18 h" },
          { id: blockId(), day: "Samedi", value: "Sur rendez-vous" },
        ],
        note: "",
      };
    case "services":
      return { ...base, type, title: "Services", items: [] };
    case "leadForm":
      return {
        ...base,
        type,
        title: "Être recontacté",
        intro: "Laissez vos coordonnées, je vous réponds rapidement.",
        buttonLabel: "Envoyer",
        fields: { name: "optional", email: "optional", phone: "optional", company: "off", message: "optional" },
      };
  }
}

export const DEFAULT_THEME: CardTheme = {
  template: "classique",
  font: "inter",
  primaryColor: "#0047BB",
  pageBackground: "#E9EDF5",
  cardBackground: "#FFFFFF",
  textColor: "#14213D",
  mutedColor: "#5B6478",
  buttonTextColor: "#FFFFFF",
  radius: 14,
  buttonStyle: "soft",
  align: "center",
  spacing: "normal",
  borderWidth: 1,
  nameSize: "md",
};

/** Variantes de présentation des modèles : mêmes données, réglages différents. */
export const TEMPLATE_PRESETS: Record<TemplateId, { label: string; description: string; theme: Partial<CardTheme> }> = {
  classique: {
    label: "Classique",
    description: "Bannière photo, logo centré, coordonnées détaillées.",
    theme: { template: "classique", align: "center", buttonStyle: "soft", radius: 14 },
  },
  portrait: {
    label: "Portrait",
    description: "Grande photo de profil mise en avant, ton personnel.",
    theme: { template: "portrait", align: "center", buttonStyle: "filled", radius: 22, nameSize: "lg" },
  },
  entreprise: {
    label: "Entreprise",
    description: "Bandeau aux couleurs de la société, alignement à gauche, sobre.",
    theme: { template: "entreprise", align: "left", buttonStyle: "outline", radius: 8, spacing: "compact" },
  },
};

export function emptyDocument(template: TemplateId = "classique", overrides?: Partial<CardTheme>): CardDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: { ...DEFAULT_THEME, ...TEMPLATE_PRESETS[template].theme, ...overrides },
    identity: {
      firstName: "",
      lastName: "",
      jobTitle: "",
      company: "",
      photoMediaId: null,
      logoMediaId: null,
      showPhoto: true,
      showLogo: true,
    },
    banner: { mediaId: null, focalX: 50, focalY: 50, height: 140, blur: 2, veilOpacity: 15 },
    blocks: [newBlock("actions"), newBlock("contacts"), newBlock("about"), newBlock("links")],
  };
}

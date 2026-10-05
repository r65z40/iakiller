import { blockId } from "@/lib/cards/client-ids";
import { DEFAULT_THEME, newBlock } from "@/lib/cards/defaults";
import { CURRENT_SCHEMA_VERSION } from "@/lib/cards/constants";
import type { CardBlock, CardTheme } from "@/lib/cards/document";
import type { PageKey, SiteDocument, SitePage } from "./document";

function page(key: PageKey, label: string, slug: string, blocks: CardBlock[]): SitePage {
  return { id: blockId(), key, label, slug, blocks };
}

/** Bloc de type donné, avec quelques champs surchargés. */
function block<T extends CardBlock["type"]>(type: T, patch: Partial<Extract<CardBlock, { type: T }>> = {}): CardBlock {
  return { ...(newBlock(type) as Extract<CardBlock, { type: T }>), ...patch } as CardBlock;
}

function servicesBlock(title: string, names: string[]): CardBlock {
  return block("services", { title, items: names.map((name) => ({ id: blockId(), name, description: "" })) });
}

const BANNER = { mediaId: null, focalX: 50, focalY: 50, height: 180, blur: 2, veilOpacity: 20 } as const;

function baseIdentity(company: string, jobTitle: string) {
  return { firstName: "", lastName: "", jobTitle, company, photoMediaId: null, logoMediaId: null, showPhoto: false, showLogo: true };
}

/** Site vierge : quatre pages prêtes à remplir. */
export function emptySiteDocument(overrides?: Partial<CardTheme>): SiteDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: { ...DEFAULT_THEME, ...overrides },
    identity: baseIdentity("", ""),
    banner: { ...BANNER },
    pages: [
      page("accueil", "Accueil", "accueil", [
        block("about", { title: "Bienvenue", text: "Présentez votre activité en quelques phrases." }),
        servicesBlock("Nos prestations", ["Prestation 1", "Prestation 2", "Prestation 3"]),
        block("gallery", { title: "En images" }),
        block("actions"),
      ]),
      page("services", "Services", "services", [servicesBlock("Nos services", ["Service 1", "Service 2", "Service 3", "Service 4"]), block("about", { title: "Notre méthode", text: "" })]),
      page("realisations", "Réalisations", "realisations", [block("gallery", { title: "Nos réalisations" }), block("beforeAfter", { title: "Avant / Après", intro: "Quelques transformations récentes." })]),
      page("contact", "Contact", "contact", [block("contacts", { title: "Nous contacter" }), block("hours"), block("map"), block("leadForm", { title: "Demander un devis" })]),
    ],
  };
}

export interface SiteTemplate {
  id: string;
  label: string;
  description: string;
}

/** Modèles de mini-sites par métier (catalogue affiché à la création). */
export const SITE_TEMPLATES: SiteTemplate[] = [
  { id: "vierge", label: "Site vierge", description: "Quatre pages à remplir librement." },
  { id: "artisan", label: "Artisan du bâtiment", description: "Plombier, électricien, maçon : services, réalisations avant/après, devis." },
  { id: "beaute", label: "Beauté & bien-être", description: "Coiffeur, esthétique, massage : prestations, galerie, prise de rendez-vous." },
  { id: "restaurant", label: "Restaurant", description: "Carte, ambiance en images, horaires et réservation." },
  { id: "liberal", label: "Profession libérale", description: "Consultant, thérapeute, coach : présentation, services, prise de rendez-vous." },
];

export function buildSiteTemplate(id: string): SiteDocument {
  switch (id) {
    case "artisan":
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        theme: { ...DEFAULT_THEME, template: "entreprise", align: "left", primaryColor: "#B4530A", buttonStyle: "filled" },
        identity: baseIdentity("Votre entreprise", "Artisan du bâtiment"),
        banner: { ...BANNER },
        pages: [
          page("accueil", "Accueil", "accueil", [
            block("about", { title: "Votre artisan de confiance", text: "Interventions soignées, devis gratuit, travail garanti. Présentez ici votre savoir-faire et votre zone d'intervention." }),
            servicesBlock("Nos prestations", ["Dépannage d'urgence", "Rénovation", "Installation neuve", "Entretien"]),
            block("reviews", { title: "Ils nous recommandent" }),
            block("actions"),
          ]),
          page("services", "Services", "services", [servicesBlock("Nos interventions", ["Dépannage d'urgence", "Rénovation complète", "Mise aux normes", "Contrat d'entretien"]), block("documents", { title: "Nos tarifs" })]),
          page("realisations", "Réalisations", "realisations", [block("beforeAfter", { title: "Avant / Après", intro: "Nos chantiers récents." }), block("gallery", { title: "En images" })]),
          page("contact", "Contact", "contact", [block("map", { title: "Zone d'intervention", radiusKm: 30 }), block("hours"), block("contacts", { title: "Nous joindre" }), block("leadForm", { title: "Demander un devis", intro: "Décrivez votre projet, réponse sous 24 h.", allowPhotos: true })]),
        ],
      };
    case "beaute":
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        theme: { ...DEFAULT_THEME, template: "portrait", primaryColor: "#B5157E", radius: 22, buttonStyle: "soft" },
        identity: baseIdentity("Votre salon", "Beauté & bien-être"),
        banner: { ...BANNER },
        pages: [
          page("accueil", "Accueil", "accueil", [
            block("about", { title: "Votre parenthèse beauté", text: "Un lieu, une équipe, un savoir-faire. Présentez votre univers ici." }),
            servicesBlock("Nos prestations", ["Coupe & coiffage", "Coloration", "Soins", "Maquillage"]),
            block("gallery", { title: "Nos réalisations" }),
            block("appointment", { title: "Réserver", label: "Prendre rendez-vous" }),
          ]),
          page("services", "Prestations", "prestations", [servicesBlock("Nos prestations", ["Coupe femme / homme", "Coloration & balayage", "Soins du visage", "Épilation", "Maquillage"])]),
          page("realisations", "Galerie", "galerie", [block("gallery", { title: "Avant / Après" }), block("beforeAfter", { title: "Transformations" })]),
          page("contact", "Contact", "contact", [block("hours"), block("contacts", { title: "Nous trouver" }), block("appointment", { title: "Réserver en ligne", label: "Prendre rendez-vous" }), block("leadForm", { title: "Nous écrire" })]),
        ],
      };
    case "restaurant":
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        theme: { ...DEFAULT_THEME, template: "classique", primaryColor: "#7A1E1E", radius: 10 },
        identity: baseIdentity("Votre restaurant", "Cuisine maison"),
        banner: { ...BANNER },
        pages: [
          page("accueil", "Accueil", "accueil", [
            block("about", { title: "Bienvenue à notre table", text: "Une cuisine de saison, des produits frais. Racontez votre maison ici." }),
            block("gallery", { title: "L'ambiance & les plats" }),
            block("hours", { title: "Horaires d'ouverture" }),
            block("appointment", { title: "Réserver une table", label: "Réserver" }),
          ]),
          page("services", "La carte", "carte", [servicesBlock("Nos spécialités", ["Entrées", "Plats", "Desserts", "Menu du jour"]), block("documents", { title: "Notre carte (PDF)" })]),
          page("realisations", "Galerie", "galerie", [block("gallery", { title: "En images" })]),
          page("contact", "Contact", "contact", [block("map", { title: "Nous situer" }), block("hours"), block("contacts", { title: "Réservations" }), block("leadForm", { title: "Privatisation & groupes" })]),
        ],
      };
    case "liberal":
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        theme: { ...DEFAULT_THEME, template: "entreprise", align: "left", primaryColor: "#0F766E" },
        identity: baseIdentity("", "Profession libérale"),
        banner: { ...BANNER },
        pages: [
          page("accueil", "Accueil", "accueil", [
            block("about", { title: "À propos", text: "Présentez votre parcours, votre approche et les personnes que vous accompagnez." }),
            servicesBlock("Mon accompagnement", ["Première consultation", "Suivi personnalisé", "Ateliers"]),
            block("appointment", { title: "Prendre rendez-vous", label: "Réserver un créneau" }),
          ]),
          page("services", "Prestations", "prestations", [servicesBlock("Mes prestations", ["Consultation individuelle", "Suivi", "Accompagnement en ligne"]), block("about", { title: "Ma méthode", text: "" })]),
          page("realisations", "Témoignages", "temoignages", [block("reviews", { title: "Témoignages" }), block("about", { title: "Ils m'ont fait confiance", text: "" })]),
          page("contact", "Contact", "contact", [block("contacts", { title: "Me contacter" }), block("appointment", { title: "Rendez-vous", label: "Réserver" }), block("leadForm", { title: "Me laisser un message" })]),
        ],
      };
    default:
      return emptySiteDocument();
  }
}

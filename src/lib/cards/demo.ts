import type { CardDocument } from "./document";
import { DEFAULT_THEME, TEMPLATE_PRESETS } from "./defaults";

/**
 * Cartes de démonstration ENTIÈREMENT FICTIVES (personnes, sociétés, numéros réservés
 * à la fiction, domaines .exemple). Visuels : illustrations SVG originales du projet.
 */
export const DEMO_MEDIA: Record<string, { url: string; name: string; sizeBytes: number }> = {
  "demo-banner-atelier": { url: "/demo/banner-atelier.svg", name: "Bannière", sizeBytes: 900 },
  "demo-banner-conseil": { url: "/demo/banner-conseil.svg", name: "Bannière", sizeBytes: 600 },
  "demo-banner-batiment": { url: "/demo/banner-batiment.svg", name: "Bannière", sizeBytes: 400 },
  "demo-logo-atelier": { url: "/demo/logo-atelier.svg", name: "Logo", sizeBytes: 300 },
  "demo-logo-conseil": { url: "/demo/logo-conseil.svg", name: "Logo", sizeBytes: 300 },
  "demo-logo-batiment": { url: "/demo/logo-batiment.svg", name: "Logo", sizeBytes: 300 },
  "demo-portrait": { url: "/demo/portrait.svg", name: "Portrait", sizeBytes: 300 },
};

export const DEMO_CARDS: { id: string; title: string; template: string; document: CardDocument }[] = [
  {
    id: "classique",
    title: "Camille Moreau – Atelier Moreau",
    template: "Classique",
    document: {
      schemaVersion: 1,
      theme: { ...DEFAULT_THEME, ...TEMPLATE_PRESETS.classique.theme },
      identity: { firstName: "Camille", lastName: "Moreau", jobTitle: "Menuisière agenceuse", company: "Atelier Moreau (exemple fictif)", photoMediaId: null, logoMediaId: "demo-logo-atelier", showPhoto: true, showLogo: true },
      banner: { mediaId: "demo-banner-atelier", focalX: 50, focalY: 50, height: 140, blur: 2, veilOpacity: 15 },
      blocks: [
        { id: "d1act", hidden: false, type: "actions", showCall: true, showEmail: true, showVcard: true, showWallet: true, callLabel: "Appeler", emailLabel: "Envoyer un mail", vcardLabel: "Ajouter aux contacts" },
        { id: "d1con", hidden: false, type: "contacts", title: "Coordonnées", items: [
          { id: "item-c1", kind: "mobile", label: "Mobile · Camille Moreau", value: "06 39 98 12 34" },
          { id: "item-c2", kind: "landline", label: "Atelier", value: "01 99 00 12 34" },
          { id: "item-c3", kind: "email", label: "Email", value: "contact@atelier-moreau.exemple" },
          { id: "item-c4", kind: "address", label: "L'atelier", value: "12 rue des Établis\n00000 Villefictive" },
        ] },
        { id: "d1abo", hidden: false, type: "about", title: "Atelier Moreau", text: "Agencement sur mesure pour particuliers et professionnels : cuisines, dressings, bibliothèques et mobilier de boutique.", tags: ["Sur mesure", "Bois massif", "Pose comprise", "Devis gratuit"] },
        { id: "d1lnk", hidden: false, type: "links", title: "", items: [
          { id: "item-l1", title: "Découvrir nos réalisations", subtitle: "www.atelier-moreau.exemple", url: "https://www.atelier-moreau.exemple/", icon: "web" },
          { id: "item-l2", title: "LinkedIn · Atelier Moreau", subtitle: "Suivre les actualités de l'atelier", url: "https://www.linkedin.com/", icon: "linkedin" },
        ] },
        { id: "d1hrs", hidden: false, type: "hours", title: "Horaires", rows: [{ id: "item-h1", day: "Lundi – vendredi", value: "8 h – 18 h" }, { id: "item-h2", day: "Samedi", value: "Sur rendez-vous" }], note: "" },
      ],
    },
  },
  {
    id: "portrait",
    title: "Léa Bernard – Conseil",
    template: "Portrait",
    document: {
      schemaVersion: 1,
      theme: { ...DEFAULT_THEME, ...TEMPLATE_PRESETS.portrait.theme, primaryColor: "#8A4B1F", pageBackground: "#F5EEE7", font: "source" },
      identity: { firstName: "Léa", lastName: "Bernard", jobTitle: "Consultante en organisation", company: "LB Conseil (exemple fictif)", photoMediaId: "demo-portrait", logoMediaId: "demo-logo-conseil", showPhoto: true, showLogo: true },
      banner: { mediaId: "demo-banner-conseil", focalX: 50, focalY: 50, height: 120, blur: 0, veilOpacity: 0 },
      blocks: [
        { id: "d2act", hidden: false, type: "actions", showCall: true, showEmail: true, showVcard: true, showWallet: true, callLabel: "Appeler", emailLabel: "Écrire", vcardLabel: "Enregistrer le contact" },
        { id: "d2abo", hidden: false, type: "about", title: "Accompagnement", text: "J'aide les TPE à **structurer leurs process** et à gagner du temps au quotidien.\n\n- Diagnostic en une demi-journée\n- Plan d'action concret\n- Suivi trimestriel", tags: [] },
        { id: "d2app", hidden: false, type: "appointment", title: "Premier échange", label: "Réserver 30 minutes", url: "https://agenda.exemple/lea-bernard", note: "Visioconférence ou téléphone, sans engagement." },
        { id: "d2frm", hidden: false, type: "leadForm", title: "Être recontacté", intro: "Laissez vos coordonnées, je vous réponds sous 48 h ouvrées.", buttonLabel: "Envoyer", fields: { name: "required", email: "optional", phone: "optional", company: "optional", message: "optional" }, customFields: [], notifyEmails: [], includeContentInEmail: false },
      ],
    },
  },
  {
    id: "entreprise",
    title: "Hugo Petit – Bâti Exemple",
    template: "Entreprise",
    document: {
      schemaVersion: 1,
      theme: { ...DEFAULT_THEME, ...TEMPLATE_PRESETS.entreprise.theme, primaryColor: "#0F5132", pageBackground: "#E8F0EC" },
      identity: { firstName: "Hugo", lastName: "Petit", jobTitle: "Conducteur de travaux", company: "Bâti Exemple SAS (fictif)", photoMediaId: null, logoMediaId: "demo-logo-batiment", showPhoto: true, showLogo: true },
      banner: { mediaId: "demo-banner-batiment", focalX: 50, focalY: 50, height: 110, blur: 0, veilOpacity: 0 },
      blocks: [
        { id: "d3act", hidden: false, type: "actions", showCall: true, showEmail: true, showVcard: true, showWallet: true, callLabel: "Appeler", emailLabel: "Envoyer un mail", vcardLabel: "Ajouter aux contacts" },
        { id: "d3con", hidden: false, type: "contacts", title: "Contact", items: [
          { id: "item-c1", kind: "mobile", label: "Mobile", value: "06 39 98 45 67" },
          { id: "item-c2", kind: "whatsapp", label: "WhatsApp chantier", value: "06 39 98 45 67" },
          { id: "item-c3", kind: "email", label: "Email", value: "h.petit@bati.exemple" },
          { id: "item-c4", kind: "website", label: "Site", value: "https://www.bati.exemple" },
        ] },
        { id: "d3srv", hidden: false, type: "services", title: "Nos métiers", items: [
          { id: "item-s1", name: "Gros œuvre", description: "Maçonnerie, fondations, extensions." },
          { id: "item-s2", name: "Rénovation énergétique", description: "Isolation, menuiseries, ventilation." },
          { id: "item-s3", name: "Maîtrise d'œuvre", description: "Coordination de chantier tous corps d'état." },
        ] },
        { id: "d3soc", hidden: false, type: "social", title: "Réseaux", items: [{ id: "item-r1", network: "linkedin", label: "Bâti Exemple", url: "https://www.linkedin.com/" }] },
      ],
    },
  },
];

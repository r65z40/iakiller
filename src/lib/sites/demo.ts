import { DEFAULT_THEME } from "@/lib/cards/defaults";
import type { SiteDocument } from "./document";

/**
 * Mini-site de DÉMONSTRATION, entièrement fictif (société, numéros et domaines .exemple).
 * Réutilise les illustrations de démonstration du projet. Sert l'aperçu interactif public.
 */
export const DEMO_SITE: SiteDocument = {
  schemaVersion: 1,
  theme: { ...DEFAULT_THEME, template: "entreprise", align: "left", primaryColor: "#B4530A", buttonStyle: "filled", radius: 10 },
  identity: {
    firstName: "",
    lastName: "",
    jobTitle: "Artisan menuisier · agencement sur mesure",
    company: "Atelier Moreau (exemple fictif)",
    photoMediaId: null,
    logoMediaId: "demo-logo-atelier",
    showPhoto: false,
    showLogo: true,
  },
  banner: { mediaId: "demo-banner-atelier", focalX: 50, focalY: 50, height: 180, blur: 2, veilOpacity: 20 },
  pages: [
    {
      id: "p-accueil",
      key: "accueil",
      label: "Accueil",
      slug: "accueil",
      blocks: [
        { id: "a-about", hidden: false, type: "about", title: "Votre artisan de confiance", text: "Agencement sur mesure pour particuliers et professionnels : cuisines, dressings, bibliothèques et mobilier de boutique. Devis gratuit, travail garanti.", tags: ["Sur mesure", "Bois massif", "Pose comprise", "Devis gratuit"] },
        { id: "a-serv", hidden: false, type: "services", title: "Nos prestations", items: [
          { id: "s1", name: "Cuisines sur mesure", description: "Conception, fabrication et pose." },
          { id: "s2", name: "Dressings & rangements", description: "Optimisation de chaque espace." },
          { id: "s3", name: "Mobilier de boutique", description: "Agencement commercial durable." },
        ] },
        { id: "a-rev", hidden: false, type: "reviews", title: "Ils nous recommandent", platform: "google", platformName: "Google", readUrl: "https://www.google.com/", writeUrl: "", intro: "Plus de 120 avis vérifiés." },
        { id: "a-act", hidden: false, type: "actions", showCall: true, showEmail: true, showVcard: false, showWallet: false, callLabel: "Appeler l'atelier", emailLabel: "Demander un devis", vcardLabel: "Ajouter aux contacts" },
      ],
    },
    {
      id: "p-services",
      key: "services",
      label: "Services",
      slug: "services",
      blocks: [
        { id: "sv-serv", hidden: false, type: "services", title: "Nos interventions", items: [
          { id: "s4", name: "Étude & conception 3D", description: "Un plan précis avant fabrication." },
          { id: "s5", name: "Fabrication en atelier", description: "Bois massif et panneaux nobles." },
          { id: "s6", name: "Pose soignée", description: "Finitions au millimètre, chantier propre." },
          { id: "s7", name: "Rénovation", description: "Remise à neuf de meubles existants." },
        ] },
        { id: "sv-about", hidden: false, type: "about", title: "Notre méthode", text: "Un seul interlocuteur du premier croquis à la pose. Nous travaillons des matériaux durables et locaux autant que possible.", tags: [] },
      ],
    },
    {
      id: "p-real",
      key: "realisations",
      label: "Réalisations",
      slug: "realisations",
      blocks: [
        { id: "re-gal", hidden: false, type: "gallery", title: "Quelques chantiers récents", items: [
          { id: "g1", mediaId: "demo-banner-atelier", caption: "Cuisine en chêne" },
          { id: "g2", mediaId: "demo-banner-batiment", caption: "Agencement de boutique" },
        ] },
        { id: "re-about", hidden: false, type: "about", title: "Avant / Après", text: "Chaque projet est documenté. Demandez notre book complet lors de votre devis.", tags: [] },
      ],
    },
    {
      id: "p-contact",
      key: "contact",
      label: "Contact",
      slug: "contact",
      blocks: [
        { id: "c-map", hidden: false, type: "map", title: "Zone d'intervention", intro: "Nous intervenons dans un rayon de 30 km.", zones: ["Villefictive", "Bourg-Exemple", "Saint-Démo"], address: "Villefictive", lat: null, lon: null, radiusKm: 30 },
        { id: "c-hours", hidden: false, type: "hours", title: "Horaires de l'atelier", rows: [
          { id: "h1", day: "Lundi – vendredi", value: "8 h – 18 h" },
          { id: "h2", day: "Samedi", value: "Sur rendez-vous" },
        ], note: "" },
        { id: "c-contacts", hidden: false, type: "contacts", title: "Nous joindre", items: [
          { id: "cc1", kind: "mobile", label: "Mobile", value: "06 39 98 12 34" },
          { id: "cc2", kind: "email", label: "Email", value: "contact@atelier-moreau.exemple" },
        ] },
        { id: "c-form", hidden: false, type: "leadForm", title: "Demander un devis", intro: "Décrivez votre projet, réponse sous 24 h.", buttonLabel: "Envoyer", fields: { name: "required", email: "optional", phone: "required", company: "off", message: "required" }, customFields: [], notifyEmails: [], includeContentInEmail: false, allowPhotos: false, maxPhotos: 3 },
      ],
    },
  ],
};

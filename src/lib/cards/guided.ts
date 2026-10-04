import { blockId } from "./client-ids";
import { emptyDocument } from "./defaults";
import type { CardDocument, ContactKind, TemplateId } from "./document";
import { isHexColor, isValidEmail, normalizePhone, normalizeWebUrl } from "@/lib/validation/urls";

/** Réponses de l'assistant de création guidée. */
export interface GuidedAnswers {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  company?: string;
  mobile?: string;
  email?: string;
  website?: string;
  address?: string;
  template?: TemplateId;
  primaryColor?: string;
}

const clean = (v: string | undefined, max = 120) => (v ?? "").trim().slice(0, max);

/**
 * Construit un document de carte à partir de quelques réponses. Pur et testable : n'ajoute une
 * coordonnée que si elle est valide (téléphone, email, site), pour que le document soit toujours
 * accepté. Le reste est complété ensuite dans l'éditeur.
 */
export function buildGuidedDocument(answers: GuidedAnswers): CardDocument {
  const template: TemplateId = answers.template ?? "classique";
  const doc = emptyDocument(template);

  doc.identity.firstName = clean(answers.firstName, 60);
  doc.identity.lastName = clean(answers.lastName, 60);
  doc.identity.jobTitle = clean(answers.jobTitle, 80);
  doc.identity.company = clean(answers.company, 80);

  if (answers.primaryColor && isHexColor(answers.primaryColor)) doc.theme.primaryColor = answers.primaryColor.toUpperCase();

  const items: { id: string; kind: ContactKind; label: string; value: string }[] = [];
  const mobile = clean(answers.mobile, 40);
  if (mobile && normalizePhone(mobile)) items.push({ id: blockId(), kind: "mobile", label: "Mobile", value: mobile });
  const email = clean(answers.email, 254);
  if (email && isValidEmail(email)) items.push({ id: blockId(), kind: "email", label: "Email", value: email });
  const website = clean(answers.website, 300);
  if (website && normalizeWebUrl(website)) items.push({ id: blockId(), kind: "website", label: "Site web", value: website });
  const address = clean(answers.address, 300);
  if (address) items.push({ id: blockId(), kind: "address", label: "Adresse", value: address });

  for (const b of doc.blocks) {
    if (b.type === "contacts") b.items = items;
  }
  return doc;
}

/** Titre interne par défaut déduit des réponses. */
export function guidedTitle(answers: GuidedAnswers): string {
  const name = [clean(answers.firstName, 60), clean(answers.lastName, 60)].filter(Boolean).join(" ");
  return (name || clean(answers.company, 80) || "Nouvelle carte").slice(0, 80);
}

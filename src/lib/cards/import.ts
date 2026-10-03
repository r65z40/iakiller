import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { loadEntitlement } from "@/lib/billing/load";
import { isValidEmail, normalizePhone, normalizeWebUrl } from "@/lib/validation/urls";
import { inviteMember } from "@/lib/orgs/members";
import { createCard, publishCard, setCardAssignees, type Actor } from "./service";
import { emptyDocument, newBlock } from "./defaults";
import { TEMPLATES, type CardDocument, type TemplateId } from "./document";

/**
 * Import en masse des cartes de salariés depuis un fichier CSV (export Excel accepté :
 * séparateur « ; » ou « , », encodage UTF-8, guillemets).
 */
export const IMPORT_MAX_ROWS = 500;

export const IMPORT_COLUMNS = {
  prenom: "Prénom",
  nom: "Nom",
  fonction: "Fonction",
  email: "Email professionnel",
  mobile: "Mobile",
  fixe: "Téléphone fixe",
  adresse: "Adresse",
  site: "Site web",
  linkedin: "Profil LinkedIn",
} as const;
type Column = keyof typeof IMPORT_COLUMNS;

const ALIASES: Record<string, Column> = {
  prenom: "prenom", "first name": "prenom", firstname: "prenom",
  nom: "nom", "nom de famille": "nom", "last name": "nom", lastname: "nom",
  fonction: "fonction", poste: "fonction", titre: "fonction", "job title": "fonction",
  email: "email", mail: "email", "e-mail": "email", courriel: "email", "email professionnel": "email",
  mobile: "mobile", portable: "mobile", "telephone mobile": "mobile", gsm: "mobile",
  fixe: "fixe", telephone: "fixe", "telephone fixe": "fixe", tel: "fixe", "ligne directe": "fixe",
  adresse: "adresse", address: "adresse",
  site: "site", "site web": "site", website: "site", url: "site",
  linkedin: "linkedin", "profil linkedin": "linkedin",
};

const norm = (h: string) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_]+/g, " ").trim();

/** Analyse CSV (RFC 4180 + séparateur détecté sur la ligne d'en-tête). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = text.split("\n", 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export interface ImportRow {
  line: number;
  values: Record<Column, string>;
  errors: string[];
}

export function mapRows(rows: string[][]): { rows: ImportRow[]; unknownColumns: string[]; error?: string } {
  if (rows.length < 2) return { rows: [], unknownColumns: [], error: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données." };
  const header = rows[0].map(norm);
  const mapping = header.map((h) => (Object.hasOwn(ALIASES, h) ? ALIASES[h] : null));
  const unknownColumns = rows[0].filter((_, i) => !mapping[i]);
  if (!mapping.includes("prenom") && !mapping.includes("nom")) return { rows: [], unknownColumns, error: "Colonnes « prenom » et « nom » introuvables dans l'en-tête." };
  if (rows.length - 1 > IMPORT_MAX_ROWS) return { rows: [], unknownColumns, error: `${IMPORT_MAX_ROWS} lignes maximum par import.` };

  const seenEmails = new Set<string>();
  const out = rows.slice(1).map((r, i) => {
    const values = Object.fromEntries(Object.keys(IMPORT_COLUMNS).map((k) => [k, ""])) as Record<Column, string>;
    mapping.forEach((col, idx) => {
      if (col) values[col] = (r[idx] ?? "").trim().slice(0, col === "adresse" ? 300 : 120);
    });
    const errors: string[] = [];
    if (!values.prenom && !values.nom) errors.push("Prénom ou nom requis");
    if (values.email) {
      if (!isValidEmail(values.email)) errors.push("Email invalide");
      else if (seenEmails.has(values.email.toLowerCase())) errors.push("Email en double dans le fichier");
      else seenEmails.add(values.email.toLowerCase());
    }
    if (values.mobile && !normalizePhone(values.mobile)) errors.push("Mobile invalide");
    if (values.fixe && !normalizePhone(values.fixe)) errors.push("Téléphone fixe invalide");
    if (values.site && !normalizeWebUrl(values.site)) errors.push("Site web invalide");
    if (values.linkedin && !normalizeWebUrl(values.linkedin)) errors.push("Lien LinkedIn invalide");
    return { line: i + 2, values, errors };
  });
  return { rows: out, unknownColumns };
}

let seq = 0;
const itemId = () => `imp${Date.now().toString(36)}${(seq++).toString(36)}`.slice(0, 40);

export function documentFromRow(row: Record<Column, string>, template: TemplateId): CardDocument {
  const doc = emptyDocument(template);
  doc.identity.firstName = row.prenom;
  doc.identity.lastName = row.nom;
  doc.identity.jobTitle = row.fonction;
  const contacts = doc.blocks.find((b) => b.type === "contacts");
  if (contacts && contacts.type === "contacts") {
    if (row.mobile) contacts.items.push({ id: itemId(), kind: "mobile", label: "", value: row.mobile });
    if (row.fixe) contacts.items.push({ id: itemId(), kind: "landline", label: "", value: row.fixe });
    if (row.email) contacts.items.push({ id: itemId(), kind: "email", label: "", value: row.email });
    if (row.adresse) contacts.items.push({ id: itemId(), kind: "address", label: "", value: row.adresse });
    if (row.site) contacts.items.push({ id: itemId(), kind: "website", label: "", value: normalizeWebUrl(row.site)! });
  }
  if (row.linkedin) {
    const social = newBlock("social");
    if (social.type === "social") social.items.push({ id: itemId(), network: "linkedin", label: "", url: normalizeWebUrl(row.linkedin)! });
    doc.blocks.push(social);
  }
  // Les blocs vides par défaut (présentation, liens) sont masqués pour une carte importée.
  doc.blocks = doc.blocks.filter((b) => !(b.type === "about" || b.type === "links"));
  return doc;
}

export interface ImportOptions {
  template: TemplateId;
  invite: boolean;
  publish: boolean;
}

export interface ImportReport {
  created: number;
  invited: number;
  published: number;
  lines: { line: number; name: string; status: "créée" | "ignorée" | "erreur"; detail: string }[];
}

export async function runImport(actor: Actor, csv: string, opts: ImportOptions, inviterName: string): Promise<ImportReport> {
  if (!can(actor, "cards.create")) throw new DomainError("forbidden", "Import réservé aux gestionnaires.");
  if (!TEMPLATES.includes(opts.template)) throw new DomainError("invalid", "Modèle inconnu.");
  const mapped = mapRows(parseCsv(csv));
  if (mapped.error) throw new DomainError("invalid", mapped.error);
  const valid = mapped.rows.filter((r) => r.errors.length === 0);
  if (valid.length === 0) throw new DomainError("invalid", "Aucune ligne valide à importer.");

  const ent = await loadEntitlement(actor.organization.id);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.card).where(and(eq(schema.card.organizationId, actor.organization.id), ne(schema.card.status, "archived")));
  const remaining = ent.quotas.cards - (count?.n ?? 0);
  if (valid.length > remaining) {
    throw new DomainError("quota_exceeded", `Votre formule permet encore ${Math.max(0, remaining)} carte(s) ; le fichier en contient ${valid.length} valide(s). Réduisez le fichier ou changez de formule.`);
  }

  const report: ImportReport = { created: 0, invited: 0, published: 0, lines: [] };
  for (const r of mapped.rows) {
    const name = [r.values.prenom, r.values.nom].filter(Boolean).join(" ");
    if (r.errors.length) {
      report.lines.push({ line: r.line, name, status: "ignorée", detail: r.errors.join(", ") });
      continue;
    }
    try {
      const card = await createCard(actor, { title: [name, r.values.fonction].filter(Boolean).join(" – ").slice(0, 80) || "Carte importée", document: documentFromRow(r.values, opts.template) });
      report.created++;
      const details: string[] = [];
      if (opts.invite && r.values.email) {
        try {
          await inviteMember(actor, r.values.email, "member", inviterName);
          report.invited++;
          details.push("invitation envoyée (attribution à l'acceptation)");
          await db.insert(schema.pendingCardAssignment).values({ cardId: card.id, organizationId: actor.organization.id, email: r.values.email.toLowerCase() }).onConflictDoNothing();
        } catch (e) {
          // Déjà membre : attribution directe.
          const [u] = await db.select({ id: schema.user.id }).from(schema.user).innerJoin(schema.membership, eq(schema.membership.userId, schema.user.id)).where(and(eq(sql`lower(${schema.user.email})`, r.values.email.toLowerCase()), eq(schema.membership.organizationId, actor.organization.id)));
          if (u) {
            await setCardAssignees(actor, card.id, [u.id]);
            details.push("attribuée au membre existant");
          } else details.push(`invitation impossible : ${e instanceof DomainError ? e.message : "erreur"}`);
        }
      }
      if (opts.publish) {
        try {
          await publishCard(actor, card.id);
          report.published++;
          details.push("publiée");
        } catch (e) {
          details.push(`non publiée : ${e instanceof DomainError ? e.message : "erreur"}`);
        }
      }
      report.lines.push({ line: r.line, name, status: "créée", detail: details.join(" · ") || "brouillon" });
    } catch (e) {
      report.lines.push({ line: r.line, name, status: "erreur", detail: e instanceof DomainError ? e.message : "erreur inattendue" });
    }
  }
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", supportGrantId: actor.supportGrantId, action: "card.import", metadata: { created: report.created, invited: report.invited, published: report.published } });
  return report;
}

export function importTemplateCsv() {
  return "﻿" + ["prenom;nom;fonction;email;mobile;fixe;adresse;site;linkedin", "Camille;Exemple;Commerciale;camille@exemple.fr;06 39 98 12 34;01 99 00 12 34;1 rue de l'Exemple 00000 Ville;https://www.exemple.fr;"].join("\r\n") + "\r\n";
}

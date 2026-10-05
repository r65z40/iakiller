import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId, sha256 } from "@/lib/ids";
import { appUrl } from "@/lib/config";
import { isValidEmail, normalizePhone } from "@/lib/validation/urls";
import { checkLeadFormToken } from "@/lib/security/signed";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import { inArray } from "drizzle-orm";
import type { LeadInput, LeadResult } from "@/lib/leads/service";
import { isSitePubliclyAccessible } from "./public";
import { parseSiteDocument } from "./document";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const PER_SITE_DAILY = 60;

/**
 * Demande de contact envoyée depuis un mini-site publié. Alimente la MÊME table `lead`
 * (donc le CRM et les relances), sans carte liée (cardId null), source « direct ».
 */
export async function submitSiteLead(input: LeadInput, meta: { ipKey: string; now?: Date }): Promise<LeadResult> {
  const now = meta.now ?? new Date();
  if (typeof input.token !== "string" || !/^[A-Za-z0-9_-]{10,64}$/.test(input.token)) return { ok: false, status: 400, error: "Formulaire invalide." };
  if (!rateLimit(`sitelead:ip:${meta.ipKey}`, 5, 10 * 60_000, now.getTime())) {
    return { ok: false, status: 429, error: "Trop d'envois depuis votre connexion. Réessayez dans quelques minutes." };
  }

  const [site] = await db.select().from(schema.site).where(eq(schema.site.publicToken, input.token));
  if (!site || !(await isSitePubliclyAccessible(site, now))) return { ok: false, status: 404, error: "Ce mini-site n'est plus disponible." };
  const [version] = await db.select().from(schema.siteVersion).where(eq(schema.siteVersion.id, site.publishedVersionId!));
  const parsed = version ? parseSiteDocument(version.document) : null;
  const form = parsed?.success ? parsed.data.pages.flatMap((p) => p.blocks).find((b) => b.type === "leadForm" && !b.hidden) : undefined;
  if (!form || form.type !== "leadForm") return { ok: false, status: 404, error: "Aucun formulaire sur ce mini-site." };

  if (str(input.website, 200)) return { ok: true }; // champ piège
  const tokenState = checkLeadFormToken(input.formToken, site.id, now.getTime());
  if (tokenState === "too_fast") return { ok: false, status: 400, error: "Envoi trop rapide. Patientez quelques secondes puis réessayez." };
  if (tokenState !== "ok") return { ok: false, status: 400, error: "Le formulaire a expiré. Rechargez la page." };

  const values = {
    name: form.fields.name === "off" ? "" : str(input.name, 120),
    email: form.fields.email === "off" ? "" : str(input.email, 254).toLowerCase(),
    phone: form.fields.phone === "off" ? "" : str(input.phone, 32),
    company: form.fields.company === "off" ? "" : str(input.company, 120),
    message: form.fields.message === "off" ? "" : str(input.message, 2000),
  };
  for (const [k, mode] of Object.entries(form.fields)) {
    if (mode === "required" && !values[k as keyof typeof values]) return { ok: false, status: 400, error: "Merci de remplir les champs obligatoires." };
  }
  if (!values.email && !values.phone) return { ok: false, status: 400, error: "Indiquez au moins un email ou un téléphone pour être recontacté." };
  if (values.email && !isValidEmail(values.email)) return { ok: false, status: 400, error: "Adresse email invalide." };
  if (values.phone && !normalizePhone(values.phone)) return { ok: false, status: 400, error: "Numéro de téléphone invalide." };

  const extra: { label: string; value: string }[] = [];
  for (const f of form.customFields) {
    const raw = str(input[`cf_${f.id}`], f.type === "textarea" ? 2000 : 254);
    if (!raw) {
      if (f.required) return { ok: false, status: 400, error: "Merci de remplir les champs obligatoires." };
      continue;
    }
    if (f.type === "email" && !isValidEmail(raw.toLowerCase())) return { ok: false, status: 400, error: `Adresse email invalide pour « ${f.label} ».` };
    if (f.type === "tel" && !normalizePhone(raw)) return { ok: false, status: 400, error: `Numéro invalide pour « ${f.label} ».` };
    if (f.type === "select" && !f.options.includes(raw)) return { ok: false, status: 400, error: `Choix invalide pour « ${f.label} ».` };
    extra.push({ label: f.label.slice(0, 60), value: raw });
  }

  const dedupeHash = sha256(["site", site.id, values.email, values.phone, values.message].join("|"));
  const since = new Date(now.getTime() - 24 * 3600_000);
  const [dup] = await db.select({ id: schema.lead.id }).from(schema.lead).where(and(eq(schema.lead.dedupeHash, dedupeHash), gte(schema.lead.createdAt, since))).limit(1);
  if (dup) return { ok: true };

  const [daily] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.lead).where(and(eq(schema.lead.organizationId, site.organizationId), gte(schema.lead.createdAt, since)));
  if ((daily?.n ?? 0) >= PER_SITE_DAILY) return { ok: false, status: 429, error: "Le formulaire est momentanément indisponible. Réessayez plus tard." };

  const id = newId();
  await db.insert(schema.lead).values({
    id,
    organizationId: site.organizationId,
    cardId: null,
    name: values.name || null,
    email: values.email || null,
    phone: values.phone || null,
    company: values.company || null,
    message: values.message || null,
    extra: extra.length ? extra : null,
    marketingConsent: input.marketingConsent === true,
    source: "direct",
    sourceDetail: `Mini-site : ${site.title}`.slice(0, 60),
    dedupeHash,
  });
  await db.insert(schema.leadActivity).values({ id: newId(), leadId: id, organizationId: site.organizationId, kind: "created", text: `Demande reçue (mini-site « ${site.title} »)`, actorId: null });

  // Notification : propriétaires et gestionnaires de l'organisation (anti-inondation : 10/h).
  if (rateLimit(`siteleadnotif:${site.id}`, 10, 3600_000, now.getTime())) {
    const managers = await db
      .select({ email: schema.user.email })
      .from(schema.membership)
      .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
      .where(and(eq(schema.membership.organizationId, site.organizationId), inArray(schema.membership.role, ["owner", "manager"])));
    const recipients = [...new Set(managers.map((m) => m.email))].slice(0, 25);
    const email = templates.leadReceived({ cardTitle: site.title, url: `${appUrl()}/app/prospects` });
    for (const to of recipients) await sendEmail({ to, template: "leadReceived", email });
  }
  return { ok: true };
}

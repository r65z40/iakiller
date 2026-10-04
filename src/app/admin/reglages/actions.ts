"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffAction } from "@/lib/context";
import { DomainError } from "@/lib/errors";
import { getSettings } from "@/lib/settings/store";
import { updateSettingsSection } from "@/lib/settings/service";
import { LEGAL_PAGES, type LegalPageKey, type PlatformSettings, type Validation } from "@/lib/settings/schema";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(s(fd, k).replace(",", "."));
const optDays = (fd: FormData, k: string) => (s(fd, k) === "" ? null : Math.round(num(fd, k)));
const on = (fd: FormData, k: string) => fd.get(k) === "on";

/** Horodate la validation lorsqu'elle est cochée ; la retire si elle est décochée. */
function validation(fd: FormData, prefix: string, previous: Validation): Validation {
  const validated = on(fd, `${prefix}validated`);
  const by = s(fd, `${prefix}validatedBy`);
  if (!validated) return { validated: false, validatedBy: by, validatedAt: null };
  if (!by) throw new DomainError("invalid", "Indiquez qui a validé (nom du professionnel ou du cabinet).");
  return { validated: true, validatedBy: by, validatedAt: previous.validated && previous.validatedAt ? previous.validatedAt : new Date().toISOString() };
}

async function save(section: string, build: (fd: FormData, current: PlatformSettings) => Promise<void>, fd: FormData) {
  let target = `/admin/reglages?section=${section}`;
  try {
    await requireStaffAction("platform.settings.manage");
    const current = await getSettings(true);
    await build(fd, current);
    revalidatePath("/", "layout");
    target += "&ok=" + encodeURIComponent("Réglages enregistrés.");
  } catch (e) {
    if (!(e instanceof DomainError)) console.error("[reglages]", e);
    target += "&erreur=" + encodeURIComponent(e instanceof DomainError ? e.message : "Enregistrement refusé.");
  }
  redirect(target);
}

const staff = () => requireStaffAction("platform.settings.manage");

export async function saveBrandAction(fd: FormData) {
  await save("marque", async (fd, current) => {
    await updateSettingsSection(await staff(), "brand", {
      name: s(fd, "name"), tagline: s(fd, "tagline"), publicUrl: s(fd, "publicUrl").replace(/\/+$/, ""), supportEmail: s(fd, "supportEmail"), emailFrom: s(fd, "emailFrom"),
      // La vidéo d'accueil est gérée par son propre téléversement : on conserve la valeur courante.
      promoVideoKey: current.brand.promoVideoKey, promoVideoType: current.brand.promoVideoType,
    });
  }, fd);
}

export async function saveCompanyAction(fd: FormData) {
  await save("societe", async () => {
    await updateSettingsSection(await staff(), "company", {
      companyName: s(fd, "companyName"), legalForm: s(fd, "legalForm"), capital: s(fd, "capital"), address: s(fd, "address"), siren: s(fd, "siren"),
      vat: s(fd, "vat"), director: s(fd, "director"), host: s(fd, "host"), contactEmail: s(fd, "contactEmail"), dpo: s(fd, "dpo"),
    });
  }, fd);
}

export async function saveBillingAction(fd: FormData) {
  await save("tarification", async () => {
    await updateSettingsSection(await staff(), "billing", { graceDays: Math.round(num(fd, "graceDays")), annualDiscountPercent: num(fd, "annualDiscountPercent"), taxNote: s(fd, "taxNote") });
  }, fd);
}

export async function saveRetentionAction(fd: FormData) {
  await save("conservation", async () => {
    await updateSettingsSection(await staff(), "retention", {
      contentAfterEndDays: optDays(fd, "contentAfterEndDays"), deletedOrgPurgeDays: optDays(fd, "deletedOrgPurgeDays"), leadsDays: optDays(fd, "leadsDays"),
      auditDays: optDays(fd, "auditDays"), analyticsRawDays: Math.round(num(fd, "analyticsRawDays")), accountingYears: optDays(fd, "accountingYears"),
    });
  }, fd);
}

export async function saveServiceAction(fd: FormData) {
  await save("prestation", async () => {
    await updateSettingsSection(await staff(), "service", {
      conditions: s(fd, "conditions"), deliveryDelay: s(fd, "deliveryDelay"), revisionsPolicy: s(fd, "revisionsPolicy"), refundPolicy: s(fd, "refundPolicy"), published: on(fd, "published"),
    });
  }, fd);
}

export async function saveLegalAction(fd: FormData) {
  const page = s(fd, "page") as LegalPageKey;
  await save(`legal-${page}`, async (_fd, current) => {
    if (!Object.hasOwn(LEGAL_PAGES, page)) throw new DomainError("invalid", "Page inconnue.");
    const legal = { ...current.legal, [page]: { customText: s(fd, "customText"), ...validation(fd, "", current.legal[page]) } };
    await updateSettingsSection(await staff(), "legal", legal);
  }, fd);
}

export async function saveAnalyticsAction(fd: FormData) {
  await save("mesure", async (_fd, current) => {
    const raw = s(fd, "mode");
    const mode = raw === "off" || raw === "consent" ? raw : "minimal";
    // Un changement de régime appelle une nouvelle validation, datée du jour.
    const previous = mode === current.analytics.mode ? current.analytics : { validated: false, validatedBy: "", validatedAt: null };
    await updateSettingsSection(await staff(), "analytics", { mode, note: s(fd, "note"), ...validation(fd, "", previous) });
  }, fd);
}

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSettings, invalidateSettings, settingsSync } from "@/lib/settings/store";
import { updateSettingsSection, settingsBlockers } from "@/lib/settings/service";
import { mergeSettings, defaultSettings } from "@/lib/settings/schema";
import { appUrl, brand, graceDays } from "@/lib/config";
import { analyticsConfig } from "@/lib/analytics/config";
import { loadEntitlement } from "@/lib/billing/load";
import { applyRetention } from "@/lib/jobs";
import { suggestedAnnualCents, annualSaving } from "@/lib/billing/pricing";
import { createCard } from "@/lib/cards/service";
import { createOrgWithOwner, resetDb } from "../helpers";

const admin = { id: "admin-test", platformRole: "admin" };
const support = { id: "support-test", platformRole: "support" };

describe("réglages de la plateforme", () => {
  beforeEach(async () => {
    await resetDb();
    invalidateSettings();
  });

  it("repli sur les valeurs par défaut et fusion d'un état partiel", () => {
    const merged = mergeSettings({ brand: { name: "Ma Marque" }, legal: { cookies: { validated: true, validatedBy: "Me X", validatedAt: "2026-10-01T00:00:00.000Z" } } });
    expect(merged.brand.name).toBe("Ma Marque");
    expect(merged.company).toEqual(defaultSettings().company);
    expect(merged.legal.cookies.validated).toBe(true);
    expect(merged.legal.mentions.validated).toBe(false);
  });

  it("seul un administrateur peut modifier, avec validation et audit", async () => {
    await expect(updateSettingsSection(support, "brand", { ...defaultSettings().brand, name: "X" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateSettingsSection(admin, "brand", { ...defaultSettings().brand, publicUrl: "pas-une-url" })).rejects.toMatchObject({ code: "invalid" });
    await updateSettingsSection(admin, "brand", { ...defaultSettings().brand, name: "Cartopro", publicUrl: "https://cartes.exemple.fr" });
    expect(brand.name).toBe("Cartopro");
    expect(appUrl()).toBe("https://cartes.exemple.fr");
    const logs = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "settings.brand"));
    expect(logs).toHaveLength(1);
    // Relecture depuis la base (autre instance) :
    invalidateSettings();
    expect((await getSettings()).brand.name).toBe("Cartopro");
  });

  it("les informations de la société alimentent les mentions, vides = « à compléter »", async () => {
    expect(brand.legal.siren).toMatch(/À COMPLÉTER/);
    await updateSettingsSection(admin, "company", { ...defaultSettings().company, siren: "123 456 789 RCS Auxerre" });
    expect(brand.legal.siren).toBe("123 456 789 RCS Auxerre");
  });

  it("le délai de grâce réglé s'applique immédiatement aux droits", async () => {
    const { org } = await createOrgWithOwner("Grâce", new Date(Date.now() - 30 * 86400_000));
    await db.update(schema.organization).set({ stripeCustomerId: "cus_g" }).where(eq(schema.organization.id, org.id));
    await db.insert(schema.subscription).values({ id: "s1", organizationId: org.id, stripeSubscriptionId: "sub_g", stripeCustomerId: "cus_g", status: "past_due", pastDueSince: new Date(Date.now() - 5 * 86400_000), lastSyncedAt: new Date() });
    await updateSettingsSection(admin, "billing", { graceDays: 7, annualDiscountPercent: 0, taxNote: "" });
    expect((await loadEntitlement(org.id)).state).toBe("past_due_grace");
    await updateSettingsSection(admin, "billing", { graceDays: 3, annualDiscountPercent: 15, taxNote: "Prix HT" });
    expect(graceDays()).toBe(3);
    expect((await loadEntitlement(org.id)).state).toBe("payment_suspended");
  });

  it("remise annuelle de référence : suggestion et remise réelle", () => {
    expect(suggestedAnnualCents(2900, 15)).toBe(29600);
    expect(annualSaving(2900, 29600).percent).toBe(14);
  });

  it("le régime de mesure se règle et un changement exige une nouvelle validation", async () => {
    await updateSettingsSection(admin, "analytics", { mode: "consent", note: "", validated: true, validatedBy: "Cabinet Y", validatedAt: new Date().toISOString() });
    expect(analyticsConfig()).toMatchObject({ enabled: true, requireConsent: true });
    expect(settingsBlockers(settingsSync()).some((b) => b.startsWith("Régime de mesure"))).toBe(false);
    await updateSettingsSection(admin, "analytics", { ...settingsSync().analytics, mode: "off", validated: false });
    expect(analyticsConfig().enabled).toBe(false);
    expect(settingsBlockers(settingsSync()).some((b) => b.startsWith("Régime de mesure"))).toBe(true);
  });
});

describe("politique de conservation", () => {
  beforeEach(async () => {
    await resetDb();
    invalidateSettings();
  });

  it("sans durée renseignée, rien n'est supprimé", async () => {
    const { org } = await createOrgWithOwner("Ancienne", new Date(Date.now() - 400 * 86400_000));
    const r = await applyRetention();
    expect(r).toEqual({ leads: 0, audit: 0, orgsDeleted: 0, orgsPurged: 0 });
    const [o] = await db.select().from(schema.organization).where(eq(schema.organization.id, org.id));
    expect(o.deletedAt).toBeNull();
  });

  it("supprime puis purge une organisation sans droit, en conservant les factures", async () => {
    const { org, actor } = await createOrgWithOwner("Expirée longtemps", new Date(Date.now() - 400 * 86400_000));
    const recent = await createOrgWithOwner("Récente");
    await createCard(recent.actor, { title: "Garde" });
    await db.insert(schema.invoiceReference).values({ id: "inv1", organizationId: org.id, stripeInvoiceId: "in_1", status: "paid", amountDueCents: 900, amountPaidCents: 900, currency: "eur" });
    await db.insert(schema.card).values({ id: "carte-vieille", organizationId: org.id, slug: "vieille", publicToken: "tokenVieille12345", title: "Vieille", draft: (await db.select().from(schema.card).limit(1))[0].draft });
    void actor;
    await updateSettingsSection(admin, "retention", { ...defaultSettings().retention, contentAfterEndDays: 90, deletedOrgPurgeDays: 30 });

    const first = await applyRetention();
    expect(first.orgsDeleted).toBe(1);
    // La purge définitive attend le délai après suppression.
    expect(first.orgsPurged).toBe(0);
    await db.update(schema.organization).set({ deletedAt: new Date(Date.now() - 31 * 86400_000) }).where(eq(schema.organization.id, org.id));
    const second = await applyRetention();
    expect(second.orgsPurged).toBe(1);
    expect(await db.select().from(schema.card).where(eq(schema.card.organizationId, org.id))).toHaveLength(0);
    expect(await db.select().from(schema.invoiceReference).where(eq(schema.invoiceReference.organizationId, org.id))).toHaveLength(1);
    // L'organisation récente (essai en cours) n'est pas touchée.
    expect(await db.select().from(schema.card).where(eq(schema.card.organizationId, recent.org.id))).toHaveLength(1);
  });

  it("supprime les prospects au-delà de leur durée", async () => {
    const { org } = await createOrgWithOwner("Prospects anciens");
    await db.insert(schema.lead).values([
      { id: "l-old", organizationId: org.id, email: "a@exemple.test", dedupeHash: "h1", createdAt: new Date(Date.now() - 200 * 86400_000) },
      { id: "l-new", organizationId: org.id, email: "b@exemple.test", dedupeHash: "h2" },
    ]);
    await updateSettingsSection(admin, "retention", { ...defaultSettings().retention, leadsDays: 180 });
    expect((await applyRetention()).leads).toBe(1);
    expect((await db.select().from(schema.lead)).map((l) => l.id)).toEqual(["l-new"]);
  });
});

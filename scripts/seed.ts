/**
 * Données de démonstration (développement / test uniquement).
 * - Plans et prestation marqués « démonstration » : la vente reste bloquée.
 * - Compte fictif demo@exemple.test (mot de passe affiché ci-dessous) avec une organisation
 *   et des cartes fictives. Aucun paiement, avis ou revenu n'est fabriqué.
 */
import { eq } from "drizzle-orm";
import { db, pool, schema } from "../src/lib/db";
import { auth } from "../src/lib/auth";
import { createOrganization } from "../src/lib/orgs/service";
import { createCard, publishCard } from "../src/lib/cards/service";
import { DEMO_CARDS } from "../src/lib/cards/demo";

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refus : seed en production. Utilisez --force en connaissance de cause.");
  }
  // Offres et prix HT. Modifiables ensuite dans /admin/plans (ajouter les identifiants de
  // prix Stripe avant la vente). Prix en centimes ; taxBehavior "exclusive" = montants HT.
  const plans = [
    { id: "plan_solo", code: "solo", name: "Solo", description: "Pour un indépendant ou un artisan.", cardQuota: 1, storageQuotaMb: 200, memberQuota: 1, sortOrder: 1, m: 290, y: 2900 },
    { id: "plan_pro", code: "pro", name: "Pro", description: "Pour un professionnel actif, plusieurs cartes.", cardQuota: 5, storageQuotaMb: 1000, memberQuota: 5, sortOrder: 2, m: 490, y: 4900 },
    { id: "plan_equipe", code: "equipe", name: "Équipe", description: "Pour une équipe commerciale.", cardQuota: 20, storageQuotaMb: 4000, memberQuota: 20, sortOrder: 3, m: 1490, y: 14900 },
    { id: "plan_entreprise", code: "entreprise", name: "Entreprise", description: "Gestion centralisée de nombreux collaborateurs.", cardQuota: 50, storageQuotaMb: 10000, memberQuota: 50, sortOrder: 4, m: 2990, y: 29900 },
  ];
  for (const p of plans) {
    await db
      .insert(schema.plan)
      .values({ id: p.id, code: p.code, name: p.name, description: p.description, cardQuota: p.cardQuota, storageQuotaMb: p.storageQuotaMb, memberQuota: p.memberQuota, sortOrder: p.sortOrder, isDemo: false })
      .onConflictDoUpdate({ target: schema.plan.id, set: { name: p.name, description: p.description, cardQuota: p.cardQuota, storageQuotaMb: p.storageQuotaMb, memberQuota: p.memberQuota, sortOrder: p.sortOrder, isDemo: false } });
    for (const [interval, amount] of [["month", p.m], ["year", p.y]] as const) {
      await db
        .insert(schema.planPrice)
        .values({ id: `${p.id}_${interval}`, planId: p.id, interval, amountCents: amount, isDemo: false, taxBehavior: "exclusive" })
        .onConflictDoUpdate({ target: schema.planPrice.id, set: { amountCents: amount, isDemo: false } });
    }
  }
  await db.insert(schema.serviceOffer).values({ id: "offer_creation", name: "Création de carte par notre équipe", description: "Réalisation d'une carte à partir de votre brief et de vos fichiers.", amountCents: 14900, includedRevisions: 2, targetDays: 5, isDemo: true }).onConflictDoNothing();

  const email = "demo@exemple.test";
  const password = "demo-carte-2026";
  let [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!user) {
    await auth.api.signUpEmail({ body: { name: "Camille Démo", email, password } });
    await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));
    [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
    const org = await createOrganization({ id: user.id, emailVerified: true }, { name: "Atelier Exemple (démo)", slug: "atelier-exemple" });
    const actor = { user: { id: user.id }, organization: { id: org.id }, role: "owner" as const, canManageBilling: true, supportGrantId: null };
    for (const demo of DEMO_CARDS.slice(0, 3)) {
      const { document } = demo;
      const doc = structuredClone(document);
      doc.identity.logoMediaId = null;
      doc.identity.photoMediaId = null;
      doc.banner.mediaId = null;
      const c = await createCard(actor, { title: demo.title, document: doc });
      await publishCard(actor, c.id);
    }
  }
  console.log(`Données de démonstration prêtes.\nCompte : ${email} / ${password}\nOrganisation : /atelier-exemple`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});

import { eq } from "drizzle-orm";
import { getOrgContext } from "@/lib/context";
import { can } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Export du compte (propriétaire) : données structurées, sans secrets ni fichiers binaires. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx || !can(ctx, "org.delete")) return new Response("Non autorisé", { status: 403 });
  const orgId = ctx.organization.id;
  const [cards, versions, members, leads, media, invoices] = await Promise.all([
    db.select().from(schema.card).where(eq(schema.card.organizationId, orgId)),
    db.select({ cardId: schema.cardVersion.cardId, number: schema.cardVersion.number, createdAt: schema.cardVersion.createdAt }).from(schema.cardVersion).where(eq(schema.cardVersion.organizationId, orgId)),
    db.select({ name: schema.user.name, email: schema.user.email, role: schema.membership.role }).from(schema.membership).innerJoin(schema.user, eq(schema.user.id, schema.membership.userId)).where(eq(schema.membership.organizationId, orgId)),
    db.select().from(schema.lead).where(eq(schema.lead.organizationId, orgId)),
    db.select({ id: schema.mediaAsset.id, name: schema.mediaAsset.originalName, kind: schema.mediaAsset.kind, sizeBytes: schema.mediaAsset.sizeBytes, createdAt: schema.mediaAsset.createdAt }).from(schema.mediaAsset).where(eq(schema.mediaAsset.organizationId, orgId)),
    db.select().from(schema.invoiceReference).where(eq(schema.invoiceReference.organizationId, orgId)),
  ]);
  await audit({ organizationId: orgId, actorUserId: ctx.user.id, actorType: "user", action: "org.export" });
  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    organization: { name: ctx.organization.name, slug: ctx.organization.slug, createdAt: ctx.organization.createdAt },
    members,
    cards: cards.map((c) => ({ id: c.id, title: c.title, slug: c.slug, status: c.status, draft: c.draft, publishedAt: c.publishedAt })),
    versions,
    leads: leads.map(({ dedupeHash: _d, ...l }) => l),
    media,
    invoices,
  }, null, 2);
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="export-${ctx.organization.slug}.json"`, "Cache-Control": "no-store" } });
}

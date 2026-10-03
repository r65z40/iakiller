import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { newId } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { trialRules } from "@/lib/config";
import { can } from "@/lib/permissions";
import { slugify, validateOrgSlug } from "@/lib/cards/slug";
import type { Actor } from "@/lib/cards/service";

async function orgSlugAvailable(slug: string, forOrgId?: string) {
  const [org] = await db.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.slug, slug));
  if (org && org.id !== forOrgId) return false;
  const [redir] = await db
    .select({ organizationId: schema.slugRedirect.organizationId })
    .from(schema.slugRedirect)
    .where(and(eq(schema.slugRedirect.kind, "organization"), eq(schema.slugRedirect.oldSlug, slug)));
  // Une ancienne adresse reste réservée à son organisation d'origine (anti-détournement).
  if (redir && redir.organizationId !== forOrgId) return false;
  return true;
}

export async function suggestOrgSlug(name: string) {
  const root = slugify(name) || "entreprise";
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!validateOrgSlug(candidate) && (await orgSlugAvailable(candidate))) return candidate;
  }
  return `${root}-${newId(5).toLowerCase()}`;
}

/**
 * Un utilisateur a-t-il déjà bénéficié d'un essai ? (organisation créée ou possédée avec
 * un essai démarré, y compris supprimée depuis).
 */
export async function hasUsedTrial(userId: string, client: Tx | typeof db = db): Promise<boolean> {
  const [row] = await client
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .leftJoin(schema.membership, and(eq(schema.membership.organizationId, schema.organization.id), eq(schema.membership.userId, userId), eq(schema.membership.role, "owner")))
    .where(and(isNotNull(schema.organization.trialStartedAt), or(eq(schema.organization.createdById, userId), isNotNull(schema.membership.id))))
    .limit(1);
  return !!row;
}

/**
 * Crée une organisation. L'essai gratuit n'est accordé qu'une fois par utilisateur :
 * une organisation supplémentaire démarre sans essai (souscription nécessaire pour publier).
 */
export async function createOrganization(
  user: { id: string; emailVerified: boolean },
  input: { name: string; slug?: string },
  now = new Date(),
) {
  if (!user.emailVerified) throw new DomainError("forbidden", "Confirmez votre adresse email avant de créer une organisation.");
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw new DomainError("invalid", "Le nom de l'organisation est trop court.");
  const slug = input.slug ? slugify(input.slug) : await suggestOrgSlug(name);
  const problem = validateOrgSlug(slug);
  if (problem) throw new DomainError("invalid", problem);
  if (!(await orgSlugAvailable(slug))) throw new DomainError("slug_taken", "Cette adresse est déjà prise.");

  const id = newId();
  let trial = false;
  try {
    await db.transaction(async (tx) => {
      // Verrou sur l'utilisateur : deux créations simultanées ne peuvent pas obtenir deux essais.
      await tx.execute(sql`select id from ${schema.user} where id = ${user.id} for update`);
      trial = !(await hasUsedTrial(user.id, tx));
      const trialEndsAt = trial ? new Date(now.getTime() + trialRules.durationHours * 3600 * 1000) : null;
      await tx.insert(schema.organization).values({ id, name, slug, trialStartedAt: trial ? now : null, trialEndsAt, createdById: user.id });
      await tx.insert(schema.membership).values({ id: newId(), organizationId: id, userId: user.id, role: "owner", canManageBilling: true });
      await tx.insert(schema.brandSettings).values({ organizationId: id, companyName: name });
      await audit({ organizationId: id, actorUserId: user.id, actorType: "user", action: "org.create", targetType: "organization", targetId: id, metadata: { trial, trialEndsAt: trialEndsAt?.toISOString() ?? null } }, tx);
    });
  } catch (err) {
    if (String((err as { code?: string }).code) === "23505") throw new DomainError("slug_taken", "Cette adresse est déjà prise.");
    throw err;
  }
  return { id, slug, trial };
}

export async function updateOrganization(actor: Actor, input: { name?: string; slug?: string; allowIndexing?: boolean }) {
  if (!can(actor, "org.update")) throw new DomainError("forbidden", "Action réservée au propriétaire.");
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, actor.organization.id));
  if (!org) throw new DomainError("not_found", "Organisation introuvable");
  const patch: Partial<typeof schema.organization.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80);
    if (name.length < 2) throw new DomainError("invalid", "Nom trop court.");
    patch.name = name;
  }
  if (input.allowIndexing !== undefined) patch.allowIndexing = input.allowIndexing;
  let newSlug: string | null = null;
  if (input.slug !== undefined && slugify(input.slug) !== org.slug) {
    newSlug = slugify(input.slug);
    const problem = validateOrgSlug(newSlug);
    if (problem) throw new DomainError("invalid", problem);
    if (!(await orgSlugAvailable(newSlug, org.id))) throw new DomainError("slug_taken", "Cette adresse est déjà prise.");
    patch.slug = newSlug;
  }
  await db.transaction(async (tx) => {
    if (newSlug) {
      await tx.delete(schema.slugRedirect).where(and(eq(schema.slugRedirect.kind, "organization"), eq(schema.slugRedirect.oldSlug, newSlug)));
      await tx.insert(schema.slugRedirect).values({ id: newId(), kind: "organization", organizationId: org.id, oldSlug: org.slug }).onConflictDoNothing();
    }
    await tx.update(schema.organization).set(patch).where(eq(schema.organization.id, org.id));
    await audit({ organizationId: org.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", supportGrantId: actor.supportGrantId, action: "org.update", metadata: { ...input } }, tx);
  });
}

/** Transfert de propriété vers un membre existant ; l'ancien propriétaire devient gestionnaire. */
export async function transferOwnership(actor: Actor, targetUserId: string) {
  if (!can(actor, "org.transferOwnership")) throw new DomainError("forbidden", "Action réservée au propriétaire.");
  if (targetUserId === actor.user.id) throw new DomainError("invalid", "Vous êtes déjà propriétaire.");
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(schema.membership)
      .where(and(eq(schema.membership.organizationId, actor.organization.id), eq(schema.membership.userId, targetUserId)));
    if (!target) throw new DomainError("not_found", "Membre introuvable");
    await tx.update(schema.membership).set({ role: "owner", canManageBilling: true, updatedAt: new Date() }).where(eq(schema.membership.id, target.id));
    await tx
      .update(schema.membership)
      .set({ role: "manager", canManageBilling: false, updatedAt: new Date() })
      .where(and(eq(schema.membership.organizationId, actor.organization.id), eq(schema.membership.userId, actor.user.id)));
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "org.transfer_ownership", targetType: "user", targetId: targetUserId }, tx);
  });
}

/**
 * Suppression d'organisation : désactivation immédiate (cartes indisponibles) puis purge
 * selon la politique de conservation retenue. Les références de facturation sont conservées.
 */
export async function deleteOrganization(actor: Actor, confirmSlug: string) {
  if (!can(actor, "org.delete")) throw new DomainError("forbidden", "Action réservée au propriétaire.");
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, actor.organization.id));
  if (!org || org.slug !== confirmSlug) throw new DomainError("invalid", "Saisissez l'adresse exacte de l'organisation pour confirmer.");
  const [active] = await db
    .select({ id: schema.subscription.id })
    .from(schema.subscription)
    .where(and(eq(schema.subscription.organizationId, org.id), ne(schema.subscription.status, "canceled"), ne(schema.subscription.status, "incomplete_expired")));
  if (active) throw new DomainError("invalid", "Résiliez d'abord l'abonnement en cours.");
  await db.update(schema.organization).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(schema.organization.id, org.id));
  await audit({ organizationId: org.id, actorUserId: actor.user.id, actorType: "user", action: "org.delete" });
}

import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { can } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { FONTS } from "@/lib/cards/document";
import { isHexColor } from "@/lib/validation/urls";
import type { Actor } from "@/lib/cards/service";
import { isLockable } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getBrand(organizationId: string) {
  const [b] = await db.select().from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, organizationId));
  return b ?? null;
}

export async function updateBrand(
  actor: Actor,
  input: { primaryColor: string; backgroundColor: string; textColor: string; font: string; logoMediaId: string | null; companyName: string; lockedFields?: string[] },
) {
  if (!can(actor, "brand.update")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  for (const c of [input.primaryColor, input.backgroundColor, input.textColor]) {
    if (!isHexColor(c)) throw new DomainError("invalid", "Couleur invalide (#RRGGBB).");
  }
  if (!Object.hasOwn(FONTS, input.font)) throw new DomainError("invalid", "Police non autorisée.");
  if (input.logoMediaId) {
    const [m] = await db
      .select({ id: schema.mediaAsset.id })
      .from(schema.mediaAsset)
      .where(and(eq(schema.mediaAsset.id, input.logoMediaId), eq(schema.mediaAsset.organizationId, actor.organization.id), eq(schema.mediaAsset.kind, "image"), isNull(schema.mediaAsset.deletedAt)));
    if (!m) throw new DomainError("invalid", "Logo introuvable dans votre organisation.");
  }
  const current = await getBrand(actor.organization.id);
  let lockedFields = current?.lockedFields ?? [];
  if (input.lockedFields !== undefined) {
    // Seul le propriétaire peut modifier les verrous.
    if (!can(actor, "brand.lock")) throw new DomainError("forbidden", "Seul le propriétaire peut verrouiller des champs.");
    lockedFields = [...new Set(input.lockedFields.filter(isLockable))];
  }
  const values = {
    primaryColor: input.primaryColor.toUpperCase(),
    backgroundColor: input.backgroundColor.toUpperCase(),
    textColor: input.textColor.toUpperCase(),
    font: input.font,
    logoMediaId: input.logoMediaId,
    companyName: input.companyName.trim().slice(0, 80) || null,
    lockedFields,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.brandSettings)
    .values({ organizationId: actor.organization.id, ...values })
    .onConflictDoUpdate({ target: schema.brandSettings.organizationId, set: values });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", supportGrantId: actor.supportGrantId, action: "brand.update", metadata: { lockedFields } });
}

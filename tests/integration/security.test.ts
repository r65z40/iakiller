import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { db, schema } from "@/lib/db";
import { createOrgWithOwner, resetDb } from "../helpers";
import { inviteMember, changeMemberRole } from "@/lib/orgs/members";
import { newId } from "@/lib/ids";
import { uploadMedia } from "@/lib/media/service";
import { isMediaPubliclyServable } from "@/lib/cards/public";
import { recordEvent } from "@/lib/analytics/service";
import { emptyDocument } from "@/lib/cards/defaults";
import type { Actor } from "@/lib/cards/service";

describe("mode assistance : gestion des membres interdite", () => {
  beforeEach(resetDb);
  it("un acteur en mode assistance ne peut pas inviter ni changer de rôle", async () => {
    const { org, owner } = await createOrgWithOwner();
    const support: Actor = { user: { id: owner.id }, organization: { id: org.id }, role: "manager", canManageBilling: false, supportGrantId: "grant-x" };
    await expect(inviteMember(support, "complice@exemple.test", "manager", "Staff")).rejects.toMatchObject({ code: "forbidden" });
    await expect(changeMemberRole(support, "nimporte", "member")).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("mesure d'audience : pollution de prototype refusée", () => {
  beforeEach(resetDb);
  it("un type hérité du prototype (__proto__, constructor) est rejeté", async () => {
    const meta = { userAgent: "Mozilla/5.0", country: null, ipKey: "k", isInternal: false };
    for (const type of ["__proto__", "constructor", "toString"]) {
      const r = await recordEvent({ token: "A".repeat(16), viewId: "a".repeat(24), type }, meta);
      expect(r).toMatchObject({ ok: false, reason: "type" });
    }
  });
});

describe("médias masqués non servis publiquement", () => {
  beforeEach(resetDb);
  it("un média d'un bloc masqué n'est pas servi par /m, le visible l'est", async () => {
    const { org, actor } = await createOrgWithOwner();
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#0047BB" } }).png().toBuffer();
    await uploadMedia(actor, { buffer: png, name: "visible.png" }, "image");
    await uploadMedia(actor, { buffer: png, name: "secret.png" }, "image");
    const [visible, secret] = await db.select().from(schema.mediaAsset);

    const doc = emptyDocument();
    doc.identity.firstName = "Jean";
    doc.blocks = [
      { ...emptyGallery("blk-visible", false), items: [{ id: "item-visible", mediaId: visible.id, caption: "" }] },
      { ...emptyGallery("blk-secret", true), items: [{ id: "item-secret", mediaId: secret.id, caption: "" }] },
    ] as typeof doc.blocks;

    // La version publiée contient les DEUX médias dans mediaIds (comme le ferait l'ancien code) ;
    // seul le média du bloc visible doit être servi.
    const cardId = newId();
    const versionId = newId();
    await db.insert(schema.card).values({ id: cardId, organizationId: org.id, slug: "jean", title: "Carte", publicToken: "tok" + newId(16), status: "published", draft: doc, publishedVersionId: versionId });
    await db.insert(schema.cardVersion).values({ id: versionId, cardId, organizationId: org.id, number: 1, document: doc, mediaIds: [visible.id, secret.id], kind: "published" });

    expect((await isMediaPubliclyServable(visible.id)).ok).toBe(true);
    expect((await isMediaPubliclyServable(secret.id)).ok).toBe(false);
  });
});

function emptyGallery(id: string, hidden: boolean) {
  return { id, type: "gallery" as const, hidden, title: "G", items: [] as { id: string; mediaId: string; caption: string }[] };
}

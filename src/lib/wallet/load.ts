import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/media/storage";
import { appleWalletConfig } from "./apple";
import { googleWalletConfig } from "./google";

export function walletAvailability() {
  return { apple: !!appleWalletConfig(), google: !!googleWalletConfig() };
}

export async function orgImage(organizationId: string, mediaId: string | null) {
  if (!mediaId) return null;
  const [m] = await db
    .select()
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.id, mediaId), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  if (!m || m.kind !== "image") return null;
  return storage().get(m.storageKey);
}

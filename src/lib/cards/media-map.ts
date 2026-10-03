import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { MediaInfo } from "@/components/card/CardView";

/**
 * Construit la table des médias d'une carte. En mode public, les URL pointent vers /m/{id}
 * (contrôle d'accès public) ; en aperçu, vers /api/media/{id} (contrôle d'appartenance).
 */
export async function buildMediaMap(organizationId: string, ids: string[], mode: "public" | "private"): Promise<Record<string, MediaInfo>> {
  if (ids.length === 0) return {};
  const rows = await db
    .select()
    .from(schema.mediaAsset)
    .where(and(inArray(schema.mediaAsset.id, ids), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  const map: Record<string, MediaInfo> = {};
  for (const r of rows) {
    map[r.id] = {
      url: mode === "public" ? `/m/${r.id}` : `/api/media/${r.id}`,
      name: r.originalName,
      sizeBytes: r.sizeBytes,
      width: r.width,
      height: r.height,
    };
  }
  return map;
}

import { db, schema, type Tx, type DB } from "@/lib/db";
import { newId } from "@/lib/ids";

export interface AuditEntry {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "staff" | "system" | "stripe";
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  supportGrantId?: string | null;
}

/** Journal d'audit des actions critiques. Ne jamais y placer de secret ni de donnée de prospect. */
export async function audit(entry: AuditEntry, client: DB | Tx = db) {
  await client.insert(schema.auditLog).values({
    id: newId(),
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorType: entry.actorType,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    supportGrantId: entry.supportGrantId ?? null,
  });
}

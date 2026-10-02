import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { createOrganization } from "@/lib/orgs/service";
import type { Actor } from "@/lib/cards/service";
import type { OrgRole } from "@/lib/permissions";

export async function resetDb() {
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle%'`);
  const names = tables.rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}

export async function createUser(email = `${newId(8).toLowerCase()}@exemple.test`, opts: { verified?: boolean; platformRole?: string | null } = {}) {
  const id = newId();
  await db.insert(schema.user).values({ id, name: email.split("@")[0], email, emailVerified: opts.verified ?? true, platformRole: opts.platformRole ?? null });
  return { id, email, emailVerified: opts.verified ?? true };
}

export async function createOrgWithOwner(name = "Atelier Test", now = new Date()) {
  const owner = await createUser();
  const org = await createOrganization(owner, { name }, now);
  const actor: Actor = { user: { id: owner.id }, organization: { id: org.id }, role: "owner", canManageBilling: true, supportGrantId: null };
  return { owner, org, actor };
}

export async function addMember(orgId: string, role: OrgRole) {
  const u = await createUser();
  await db.insert(schema.membership).values({ id: newId(), organizationId: orgId, userId: u.id, role, canManageBilling: false });
  const actor: Actor = { user: { id: u.id }, organization: { id: orgId }, role, canManageBilling: false, supportGrantId: null };
  return { user: u, actor };
}

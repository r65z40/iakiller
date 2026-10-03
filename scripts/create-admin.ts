/**
 * Procédure sûre de création du premier administrateur plateforme.
 * Le rôle n'est JAMAIS attribuable à l'inscription ni depuis l'interface.
 *
 * Usage : npm run admin:create -- --email admin@societe.fr [--role admin|support]
 * Pré-requis : le compte existe déjà (inscription normale) et son email est vérifié.
 * Après attribution, l'administrateur doit activer la double authentification pour
 * accéder à /admin.
 */
import { eq } from "drizzle-orm";
import { db, pool, schema } from "../src/lib/db";
import { audit } from "../src/lib/audit";

async function main() {
  const args = process.argv.slice(2);
  const email = args[args.indexOf("--email") + 1]?.toLowerCase();
  const role = args.includes("--role") ? args[args.indexOf("--role") + 1] : "admin";
  const revoke = args.includes("--revoke");
  if (!email || !email.includes("@")) throw new Error("Indiquez --email");
  if (role !== "admin" && role !== "support") throw new Error("--role doit valoir admin ou support");
  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!u) throw new Error("Compte introuvable : inscrivez-vous d'abord normalement.");
  if (!u.emailVerified) throw new Error("Email non vérifié.");
  await db.update(schema.user).set({ platformRole: revoke ? null : role }).where(eq(schema.user.id, u.id));
  await audit({ actorType: "system", action: revoke ? "platform.role_revoked" : "platform.role_granted", targetType: "user", targetId: u.id, metadata: { role, via: "cli" } });
  console.log(revoke ? `Rôle retiré à ${email}.` : `Rôle « ${role} » attribué à ${email}. Activez la double authentification avant d'accéder à /admin.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e.message ?? e);
  await pool.end();
  process.exit(1);
});

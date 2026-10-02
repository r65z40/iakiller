import { DomainError } from "@/lib/errors";
import { ForbiddenError } from "@/lib/context";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Exécute une action serveur et convertit les erreurs métier en message affichable. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    if (err instanceof ForbiddenError) return { ok: false, error: "Action non autorisée." };
    // Les redirections Next.js doivent continuer leur chemin.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    console.error("[action]", err);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

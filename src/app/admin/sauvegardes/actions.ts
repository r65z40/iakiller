"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireStaffAction } from "@/lib/context";
import { DomainError } from "@/lib/errors";
import { updateSettingsSection } from "@/lib/settings/service";
import { deleteBackup, executeBackup, restoreTest, startBackup, verifyBackup } from "@/lib/backup/service";

const PATH = "/admin/sauvegardes";
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function act(fn: (staff: Awaited<ReturnType<typeof requireStaffAction>>) => Promise<string>) {
  let target: string;
  try {
    const staff = await requireStaffAction("platform.backups.manage");
    target = `${PATH}?ok=${encodeURIComponent(await fn(staff))}`;
  } catch (e) {
    if (!(e instanceof DomainError)) console.error("[sauvegardes]", e);
    target = `${PATH}?erreur=${encodeURIComponent(e instanceof DomainError ? e.message : "Action refusée ou erreur inattendue.")}`;
  }
  redirect(target);
}

/** Lance une sauvegarde : la réponse part immédiatement, le travail continue en arrière-plan. */
export async function runBackupAction() {
  await act(async (staff) => {
    const opts = { trigger: "manual" as const, actorUserId: staff.id };
    const id = await startBackup(opts);
    after(() => executeBackup(id, opts).then(() => undefined));
    return "Sauvegarde lancée. Elle apparaît ci-dessous et la page se met à jour automatiquement.";
  });
}

export async function verifyBackupAction(fd: FormData) {
  await act(async (staff) => {
    const r = await verifyBackup(s(fd, "id"), staff.id);
    if (!r.ok) throw new DomainError("invalid", `Vérification en échec : ${r.detail}`);
    return `Vérification réussie : ${r.detail}`;
  });
}

export async function restoreTestAction(fd: FormData) {
  await act(async (staff) => {
    const r = await restoreTest(s(fd, "id"), staff.id);
    if (!r.ok) throw new DomainError("invalid", `Essai de restauration en échec : ${r.detail}`);
    return r.detail;
  });
}

export async function deleteBackupAction(fd: FormData) {
  await act(async (staff) => {
    if (fd.get("confirm") !== "on") throw new DomainError("invalid", "Cochez la case de confirmation pour supprimer cette sauvegarde.");
    await deleteBackup(s(fd, "id"), staff.id);
    return "Sauvegarde supprimée (les fichiers encore utilisés par d'autres sauvegardes sont conservés).";
  });
}

export async function saveBackupPolicyAction(fd: FormData) {
  await act(async (staff) => {
    await updateSettingsSection(staff, "backup", {
      enabled: fd.get("enabled") === "on",
      frequencyHours: Number(s(fd, "frequencyHours")) as 6 | 12 | 24 | 168,
      keepDaily: Math.round(Number(s(fd, "keepDaily"))),
      keepWeekly: Math.round(Number(s(fd, "keepWeekly"))),
      keepMonthly: Math.round(Number(s(fd, "keepMonthly"))),
      alertEmail: s(fd, "alertEmail"),
    });
    return "Politique de sauvegarde enregistrée.";
  });
}

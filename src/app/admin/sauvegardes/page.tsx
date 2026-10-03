import { requireStaffPage } from "@/lib/context";
import { getSettings } from "@/lib/settings/store";
import { listBackups } from "@/lib/backup/service";
import { backupStatus } from "@/lib/backup/status";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/ui/ActionForm";
import { Flash } from "../_lib/Flash";
import { AutoRefresh } from "./AutoRefresh";
import { deleteBackupAction, restoreTestAction, runBackupAction, saveBackupPolicyAction, verifyBackupAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal";
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);
const FREQUENCIES = [
  [6, "Toutes les 6 heures"],
  [12, "Toutes les 12 heures"],
  [24, "Chaque jour"],
  [168, "Chaque semaine"],
] as const;
const TRIGGERS: Record<string, string> = { scheduled: "planifiée", manual: "manuelle", cli: "ligne de commande" };

export default async function AdminBackups({ searchParams }: PageProps<"/admin/sauvegardes">) {
  await requireStaffPage("platform.backups.manage");
  const sp = await searchParams;
  const [status, rows, settings] = await Promise.all([backupStatus(), listBackups(), getSettings()]);
  const policy = settings.backup;
  const running = rows.some((r) => r.status === "running");

  return (
    <>
      <PageHeader
        title="Sauvegardes"
        description="Base de données et fichiers des clients, chiffrés, vérifiés et restaurables même si le serveur est perdu."
        actions={
          <form action={runBackupAction}>
            <SubmitButton pendingLabel="Lancement…" disabled={running || !status.destination}>Sauvegarder maintenant</SubmitButton>
          </form>
        }
      />
      <Flash sp={sp} />
      {running && <AutoRefresh />}

      {status.warnings.length > 0 && (
        <div className="mb-6">
          <Alert tone={status.stale || !status.destination ? "danger" : "warning"} title="Points d'attention">
            <ul className="mt-1 list-disc pl-5">{status.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="État">
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold">Dernière sauvegarde réussie</dt><dd>{status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : "aucune"}</dd></div>
            <div><dt className="font-semibold">Prochaine</dt><dd>{!status.enabled ? "automatique désactivée" : status.due ? "au prochain passage des tâches planifiées (15 min max.)" : `dans moins de ${status.frequencyHours} h`}</dd></div>
            <div><dt className="font-semibold">Dernier essai de restauration réussi</dt><dd>{status.lastRestoreTestAt ? formatDateTime(status.lastRestoreTestAt) : "jamais"}</dd></div>
          </dl>
        </Panel>
        <Panel title="Configuration (serveur)">
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold">Destination</dt><dd className="break-all">{status.destination ?? "aucune (BACKUP_DRIVER)"}</dd></div>
            <div><dt className="font-semibold">Chiffrement</dt><dd>{status.encrypted ? "AES-256-GCM (BACKUP_ENCRYPTION_KEY)" : "désactivé"}</dd></div>
            <div><dt className="font-semibold">Outils PostgreSQL</dt><dd>{status.pgTools ?? "introuvables"}</dd></div>
            <div><dt className="font-semibold">Base d&apos;essai de restauration</dt><dd>{status.restoreTestConfigured ? "configurée (essai automatique hebdomadaire)" : "non configurée"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">Ces réglages sont des secrets ou dépendent du serveur : ils se définissent dans l&apos;environnement (voir docs/SAUVEGARDE.md).</p>
        </Panel>
        <Panel title="Politique">
          <form action={saveBackupPolicyAction} className="space-y-3 text-sm">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="enabled" defaultChecked={policy.enabled} className="h-4 w-4" /> Sauvegardes automatiques</label>
            <label className="block font-semibold">Fréquence
              <select name="frequencyHours" defaultValue={policy.frequencyHours} className={input}>
                {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block font-semibold">Jours<input name="keepDaily" type="number" min={1} max={90} defaultValue={policy.keepDaily} className={input} /></label>
              <label className="block font-semibold">Semaines<input name="keepWeekly" type="number" min={0} max={52} defaultValue={policy.keepWeekly} className={input} /></label>
              <label className="block font-semibold">Mois<input name="keepMonthly" type="number" min={0} max={120} defaultValue={policy.keepMonthly} className={input} /></label>
            </div>
            <p className="text-xs text-muted">Conservation : la dernière sauvegarde de chacun des N derniers jours, semaines et mois. La plus récente est toujours gardée.</p>
            <label className="block font-semibold">Email d&apos;alerte<input name="alertEmail" type="email" defaultValue={policy.alertEmail} placeholder={settings.brand.supportEmail} className={input} /></label>
            <SubmitButton>Enregistrer</SubmitButton>
          </form>
        </Panel>
      </div>

      <Panel title="Historique" className="mt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Aucune sauvegarde pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr><th className="py-2">Date</th><th>Type</th><th>État</th><th>Contenu</th><th>Vérification</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 whitespace-nowrap">{formatDateTime(r.startedAt)}<div className="font-mono text-xs text-muted">{r.id}</div></td>
                    <td>{TRIGGERS[r.trigger] ?? r.trigger}{r.encrypted && <div className="text-xs text-muted">chiffrée</div>}</td>
                    <td>
                      {r.status === "ok" ? <Badge tone="success">réussie</Badge> : r.status === "running" ? <Badge tone="brand">en cours…</Badge> : <Badge tone="danger">échec</Badge>}
                      {r.error && <div className="mt-1 max-w-xs text-xs text-danger">{r.error}</div>}
                    </td>
                    <td className="text-xs">
                      {r.status === "ok" && (
                        <>
                          Base {size(r.dbBytes)} · {r.mediaCount} fichier(s)
                          <div className="text-muted">{r.mediaCopied} copié(s), {size(r.writtenBytes)} écrits</div>
                          {r.missingFiles > 0 && <div className="text-danger">{r.missingFiles} fichier(s) introuvable(s)</div>}
                        </>
                      )}
                    </td>
                    <td className="max-w-xs text-xs">
                      {r.verifiedAt && <div>{r.verifyStatus === "ok" ? "✓" : "✗"} intégrité · {formatDateTime(r.verifiedAt)}</div>}
                      {r.restoreTestedAt && <div>{r.restoreTestStatus === "ok" ? "✓" : "✗"} restauration · {formatDateTime(r.restoreTestedAt)}</div>}
                      {r.verifyDetail && <div className="text-muted">{r.verifyDetail}</div>}
                    </td>
                    <td className="text-right">
                      {r.status === "ok" && (
                        <div className="flex flex-col items-end gap-2">
                          <form action={verifyBackupAction}><input type="hidden" name="id" value={r.id} /><SubmitButton variant="secondary" pendingLabel="Vérification…">Vérifier</SubmitButton></form>
                          {status.restoreTestConfigured && (
                            <form action={restoreTestAction}><input type="hidden" name="id" value={r.id} /><SubmitButton variant="secondary" pendingLabel="Restauration…">Tester la restauration</SubmitButton></form>
                          )}
                          <details className="text-left">
                            <summary className="cursor-pointer text-xs text-danger">Supprimer…</summary>
                            <form action={deleteBackupAction} className="mt-2 space-y-2">
                              <input type="hidden" name="id" value={r.id} />
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" /> Je confirme la suppression définitive</label>
                              <SubmitButton variant="danger" pendingLabel="Suppression…">Supprimer</SubmitButton>
                            </form>
                          </details>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Restaurer" className="mt-6">
        <div className="space-y-2 text-sm">
          <p>La restauration se fait en ligne de commande, sur le serveur ou sur une machine de secours : elle n&apos;a besoin que de la destination de sauvegarde et de la clé de chiffrement, pas de la base d&apos;origine.</p>
          <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs">{`npm run backup -- list
npm run backup -- restore latest --target-db postgres://…/nouvelle_base --media
npm run db:migrate   # avec DATABASE_URL pointant sur la nouvelle base`}</pre>
          <p className="text-xs text-muted">Procédure complète, y compris la perte totale du serveur : docs/SAUVEGARDE.md.</p>
        </div>
      </Panel>
    </>
  );
}

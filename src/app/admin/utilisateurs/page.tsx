import { requireStaffPage } from "@/lib/context";
import { searchUsers } from "@/lib/admin/service";
import { formatDate } from "@/lib/format";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../_lib/Flash";
import { disableUserAction } from "../_lib/actions";

export default async function AdminUsers({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const staff = await requireStaffPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const users = await searchUsers(staff, q);
  return (
    <>
      <PageHeader title="Utilisateurs" description="Les rôles plateforme ne s'attribuent que par le script npm run admin:create (jamais depuis l'interface)." />
      <Flash sp={sp} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Email ou nom" aria-label="Rechercher" className="min-h-10 w-72 rounded-lg border border-line px-3" /><button className="rounded-lg bg-brand px-4 text-sm font-semibold text-white">Rechercher</button></form>
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Nom</th><th>Email</th><th>Inscription</th><th>Statut</th><th></th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2">{u.name} {u.platformRole && <Badge tone="brand">{u.platformRole}</Badge>}</td>
                <td>{u.email} {!u.emailVerified && <span className="text-warning">(non vérifié)</span>}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td>{u.disabledAt ? <Badge tone="danger">Désactivé</Badge> : <Badge tone="success">Actif</Badge>}</td>
                <td className="text-right">{u.id !== staff.id && <form action={disableUserAction}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="disable" value={u.disabledAt ? "0" : "1"} /><Button size="sm" variant={u.disabledAt ? "secondary" : "ghost"}>{u.disabledAt ? "Réactiver" : "Désactiver"}</Button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

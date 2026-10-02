import Link from "next/link";
import { requireStaffPage } from "@/lib/context";
import { searchOrganizations } from "@/lib/admin/service";
import { formatDate } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminOrgs({ searchParams }: PageProps<"/admin/organisations">) {
  const staff = await requireStaffPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const orgs = await searchOrganizations(staff, q);
  return (
    <>
      <PageHeader title="Organisations" />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Nom ou adresse" aria-label="Rechercher" className="min-h-10 w-72 rounded-lg border border-line px-3" /><button className="rounded-lg bg-brand px-4 text-sm font-semibold text-white">Rechercher</button></form>
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Nom</th><th>Adresse</th><th>Créée</th><th>Fin d&apos;essai</th><th>État</th></tr></thead>
          <tbody className="divide-y divide-line">
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="py-2"><Link href={`/admin/organisations/${o.id}`} className="font-semibold text-brand hover:underline">{o.name}</Link></td>
                <td>/{o.slug}</td><td>{formatDate(o.createdAt)}</td><td>{formatDate(o.trialEndsAt)}</td>
                <td>{o.deletedAt ? <Badge>Supprimée</Badge> : o.adminSuspendedAt ? <Badge tone="danger">Suspendue</Badge> : <Badge tone="success">Active</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

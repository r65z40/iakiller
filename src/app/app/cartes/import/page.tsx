import { requireOrgPage } from "@/lib/context";
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/cards/import";
import { PageHeader, Panel } from "@/components/ui";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  await requireOrgPage("cards.create");
  return (
    <div className="max-w-5xl">
      <PageHeader title="Importer des cartes" description="Créez en une fois les cartes de vos salariés à partir d'un fichier CSV (export Excel accepté)." />
      <Panel title="Format du fichier" className="mb-6">
        <p className="text-sm text-muted">Une ligne d&apos;en-tête, puis une ligne par personne, séparateur « ; » ou « , », encodage UTF-8. {IMPORT_MAX_ROWS} lignes maximum. Colonnes reconnues :</p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
          {Object.entries(IMPORT_COLUMNS).map(([k, l]) => <li key={k}><code className="rounded bg-surface px-1">{k}</code> {l}</li>)}
        </ul>
        <p className="mt-3 text-sm"><DownloadLink href="/app/cartes/import/modele" className="font-semibold text-brand underline">Télécharger un modèle de fichier</DownloadLink></p>
        <p className="mt-2 text-xs text-muted">Les couleurs, la police, le logo et le nom de société de votre identité d&apos;entreprise sont appliqués automatiquement. Importez uniquement des données que vos salariés ont accepté de voir figurer sur leur carte.</p>
      </Panel>
      <ImportClient />
    </div>
  );
}

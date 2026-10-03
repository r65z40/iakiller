"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Panel } from "@/components/ui";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { previewImportAction, runImportAction } from "../../_actions/cards";

type Preview = Extract<Awaited<ReturnType<typeof previewImportAction>>, { ok: true }>["data"];
type Report = Extract<Awaited<ReturnType<typeof runImportAction>>, { ok: true }>["data"];

export function ImportClient() {
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState("classique");
  const [invite, setInvite] = useState(false);
  const [publish, setPublish] = useState(false);
  const [pending, start] = useTransition();

  const valid = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const overQuota = preview ? valid > preview.remaining : false;

  return (
    <div className="space-y-6">
      <Panel title="1. Choisir le fichier">
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 2_000_000) { setError("Fichier trop volumineux (2 Mo maximum)."); return; }
          const text = await f.text();
          setFileName(f.name);
          setCsv(text);
          setReport(null);
          setError(null);
          start(async () => {
            const r = await previewImportAction(text);
            if (r.ok) setPreview(r.data);
            else { setPreview(null); setError(r.error); }
          });
        }} />
        <Button type="button" onClick={() => input.current?.click()} disabled={pending}>{fileName ? `Changer de fichier (${fileName})` : "Choisir un fichier CSV"}</Button>
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      </Panel>

      {preview && !report && (
        <Panel title="2. Vérifier" description={`${valid} ligne(s) valide(s) sur ${preview.rows.length} · ${preview.remaining} carte(s) encore disponible(s) dans votre formule.`}>
          {preview.unknownColumns.length > 0 && <div className="mb-3"><Alert tone="info">Colonnes ignorées : {preview.unknownColumns.join(", ")}</Alert></div>}
          {overQuota && <div className="mb-3"><Alert tone="warning">Le fichier dépasse votre quota : réduisez-le ou changez de formule avant d&apos;importer.</Alert></div>}
          <div className="max-h-96 overflow-auto rounded-lg ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-muted"><tr><th className="p-2">Ligne</th><th>Nom</th><th>Fonction</th><th>Email</th><th>Mobile</th><th>État</th></tr></thead>
              <tbody className="divide-y divide-line">
                {preview.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="p-2">{r.line}</td>
                    <td>{[r.values.prenom, r.values.nom].filter(Boolean).join(" ")}</td>
                    <td>{r.values.fonction}</td>
                    <td>{r.values.email}</td>
                    <td>{r.values.mobile}</td>
                    <td>{r.errors.length ? <span className="text-xs font-semibold text-danger">{r.errors.join(", ")}</span> : <Badge tone="success">OK</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <fieldset className="mt-4 space-y-2 text-sm">
            <legend className="font-semibold">Options</legend>
            <label className="block">Modèle
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className="ml-2 min-h-9 rounded-lg border border-line px-2">
                {Object.entries(TEMPLATE_PRESETS).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="mt-0.5 h-4 w-4" /> Inviter chaque salarié disposant d&apos;un email (rôle collaborateur) : sa carte lui sera attribuée à l&apos;acceptation. Les invitations comptent dans le quota de membres.</label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={publish} disabled={!preview.canPublish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5 h-4 w-4" /> Publier directement les cartes {preview.canPublish ? "" : "(nécessite un essai ou un abonnement actif)"}</label>
          </fieldset>
          <Button type="button" className="mt-4" disabled={pending || valid === 0 || overQuota || !csv} onClick={() => start(async () => {
            const r = await runImportAction(csv!, { template, invite, publish });
            if (r.ok) setReport(r.data);
            else setError(r.error);
          })}>{pending ? "Import en cours…" : `Importer ${valid} carte(s)`}</Button>
        </Panel>
      )}

      {report && (
        <Panel title="3. Résultat" description={`${report.created} carte(s) créée(s) · ${report.invited} invitation(s) · ${report.published} publiée(s)`}>
          <ul className="max-h-96 divide-y divide-line overflow-auto text-sm">
            {report.lines.map((l) => (
              <li key={l.line} className="flex flex-wrap justify-between gap-2 py-2">
                <span>Ligne {l.line} · <strong>{l.name || "—"}</strong></span>
                <span className={l.status === "créée" ? "text-success" : "text-danger"}>{l.status} · {l.detail}</span>
              </li>
            ))}
          </ul>
          <Link href="/app/cartes" className="mt-4 inline-block font-semibold text-brand underline">Voir les cartes</Link>
        </Panel>
      )}
    </div>
  );
}

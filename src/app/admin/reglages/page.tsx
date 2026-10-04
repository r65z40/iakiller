import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/context";
import { getSettings } from "@/lib/settings/store";
import { LEGAL_PAGES, missingCompanyFields, type LegalPageKey, type Validation } from "@/lib/settings/schema";
import { settingsBlockers } from "@/lib/settings/service";
import { envAppUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../_lib/Flash";
import { PromoVideoField } from "./PromoVideoField";
import {
  saveAnalyticsAction, saveBillingAction, saveBrandAction, saveCompanyAction, saveLegalAction, saveRetentionAction, saveServiceAction,
} from "./actions";

const input = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm font-normal";
const area = "mt-1 block w-full rounded-lg border border-line p-3 text-sm font-normal";

function F({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm font-semibold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function ValidationFields({ v, what }: { v: Validation; what: string }) {
  return (
    <fieldset className="rounded-lg bg-surface p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-bold">Validation juridique</legend>
      <p className="text-xs text-muted">Ne cochez qu&apos;après relecture de {what} par un professionnel du droit. L&apos;administration enregistre qui a validé et quand ; toute modification du régime ou du texte doit être revalidée.</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="validated" defaultChecked={v.validated} className="h-4 w-4" /> Validé par un professionnel</label>
      <label className="mt-2 block text-sm font-semibold">Validé par (nom, cabinet)<input name="validatedBy" defaultValue={v.validatedBy} maxLength={120} className={input} /></label>
      {v.validated && v.validatedAt && <p className="mt-2 text-xs text-success">Validé le {formatDateTime(v.validatedAt)} par {v.validatedBy}.</p>}
    </fieldset>
  );
}

const SECTIONS = [
  ["marque", "Marque et domaine"],
  ["societe", "Société"],
  ["tarification", "Tarification et impayés"],
  ["conservation", "Conservation des données"],
  ["prestation", "Création accompagnée"],
  ...Object.entries(LEGAL_PAGES).map(([k, l]) => [`legal-${k}`, l] as const),
  ["mesure", "Mesure d'audience"],
] as const;

export default async function SettingsAdmin({ searchParams }: PageProps<"/admin/reglages">) {
  await requireStaffPage("platform.settings.manage");
  const sp = await searchParams;
  const section = typeof sp.section === "string" && SECTIONS.some(([k]) => k === sp.section) ? sp.section : "marque";
  const s = await getSettings(true);
  const blockers = [...missingCompanyFields(s).map((f) => `Société : ${f} manquant`), ...settingsBlockers(s)];

  let body: ReactNode = null;
  if (section === "marque") {
    const domainChanged = s.brand.publicUrl && s.brand.publicUrl !== envAppUrl();
    body = (
      <form action={saveBrandAction} className="grid gap-4 sm:grid-cols-2">
        <F label="Nom de marque" hint="Affiché sur le site, l'espace client, les cartes et les emails."><input name="name" defaultValue={s.brand.name} required maxLength={60} className={input} /></F>
        <F label="Accroche"><input name="tagline" defaultValue={s.brand.tagline} maxLength={160} className={input} /></F>
        <F label="Domaine public (URL canonique)" wide hint={<>Exemple : https://cartes.mon-entreprise.fr. Utilisé pour les adresses des cartes, les QR codes et les liens des emails. Le DNS et le certificat HTTPS doivent pointer vers ce serveur. URL technique actuelle (APP_URL) : <code>{envAppUrl()}</code>.</>}>
          <input name="publicUrl" defaultValue={s.brand.publicUrl} placeholder="https://" maxLength={200} className={input} />
        </F>
        {domainChanged && (
          <div className="sm:col-span-2"><Alert tone="warning" title="Changement de domaine">Les QR codes déjà imprimés contiennent l&apos;ancien domaine : conservez une redirection de l&apos;ancien vers le nouveau. Redémarrez l&apos;application pour que l&apos;authentification (liens de vérification, cookies) adopte le nouveau domaine, et mettez APP_URL à jour lors du prochain déploiement.</Alert></div>
        )}
        <F label="Email d'assistance"><input name="supportEmail" type="email" defaultValue={s.brand.supportEmail} className={input} /></F>
        <F label="Expéditeur des emails" hint="Ex. Marque <no-reply@domaine.fr> ; le domaine doit être autorisé chez votre fournisseur SMTP (SPF/DKIM)."><input name="emailFrom" defaultValue={s.brand.emailFrom} className={input} /></F>
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
    body = (
      <>
        {body}
        <PromoVideoField hasVideo={!!s.brand.promoVideoKey} />
      </>
    );
  } else if (section === "societe") {
    const c = s.company;
    body = (
      <form action={saveCompanyAction} className="grid gap-4 sm:grid-cols-2">
        <F label="Raison sociale"><input name="companyName" defaultValue={c.companyName} className={input} /></F>
        <F label="Forme juridique"><input name="legalForm" defaultValue={c.legalForm} placeholder="SAS, SARL, EI…" className={input} /></F>
        <F label="Capital social"><input name="capital" defaultValue={c.capital} className={input} /></F>
        <F label="SIREN / RCS"><input name="siren" defaultValue={c.siren} className={input} /></F>
        <F label="Adresse du siège" wide><input name="address" defaultValue={c.address} className={input} /></F>
        <F label="N° de TVA intracommunautaire"><input name="vat" defaultValue={c.vat} className={input} /></F>
        <F label="Directeur ou directrice de la publication"><input name="director" defaultValue={c.director} className={input} /></F>
        <F label="Hébergeur (nom, adresse, téléphone)" wide><input name="host" defaultValue={c.host} className={input} /></F>
        <F label="Email de contact légal"><input name="contactEmail" type="email" defaultValue={c.contactEmail} className={input} /></F>
        <F label="Délégué à la protection des données (si désigné)"><input name="dpo" defaultValue={c.dpo} className={input} /></F>
        <p className="text-xs text-muted sm:col-span-2">Ces informations alimentent les mentions légales, la politique de confidentialité et les conditions. Les champs vides restent affichés comme « à compléter ».</p>
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
  } else if (section === "tarification") {
    body = (
      <form action={saveBillingAction} className="grid gap-4 sm:grid-cols-2">
        <F label="Délai de grâce en cas d'impayé (jours)" hint="Pendant ce délai, les cartes restent en ligne après un échec de paiement. 0 = suspension immédiate. Les nouveaux impayés appliquent la valeur en vigueur."><input name="graceDays" type="number" min={0} max={60} defaultValue={s.billing.graceDays} className={input} /></F>
        <F label="Remise annuelle de référence (%)" hint="Sert à proposer le prix annuel à partir du mensuel dans « Plans et prestations ». La remise affichée aux clients est toujours recalculée à partir des prix réels."><input name="annualDiscountPercent" type="number" min={0} max={90} step="0.5" defaultValue={s.billing.annualDiscountPercent} className={input} /></F>
        <F label="Mention fiscale affichée sous les tarifs" wide hint="Ex. « Prix HT, TVA 20 % en sus ». À valider avec votre expert-comptable."><input name="taxNote" defaultValue={s.billing.taxNote} maxLength={300} className={input} /></F>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><Button size="sm">Enregistrer</Button><Link href="/admin/plans" className="self-center text-sm font-semibold text-brand underline">Modifier les prix réels des plans →</Link></div>
      </form>
    );
  } else if (section === "conservation") {
    const r = s.retention;
    body = (
      <form action={saveRetentionAction} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Alert tone="warning">Laisser un champ vide signifie « aucune suppression automatique ». Une durée renseignée déclenche des suppressions réelles lors des tâches planifiées : vérifiez-la avec votre conseil avant de l&apos;activer.</Alert></div>
        <F label="Contenus après la fin de droit (jours)" hint="Une organisation sans essai ni abonnement actif depuis cette durée est supprimée (cartes indisponibles, compte fermé à l'organisation)."><input name="contentAfterEndDays" type="number" min={1} defaultValue={r.contentAfterEndDays ?? ""} className={input} /></F>
        <F label="Purge définitive des organisations supprimées (jours)" hint="Effacement des cartes, médias, prospects et statistiques. Les références de factures sont conservées."><input name="deletedOrgPurgeDays" type="number" min={1} defaultValue={r.deletedOrgPurgeDays ?? ""} className={input} /></F>
        <F label="Demandes de prospects (jours)"><input name="leadsDays" type="number" min={1} defaultValue={r.leadsDays ?? ""} className={input} /></F>
        <F label="Journal d'audit (jours)"><input name="auditDays" type="number" min={1} defaultValue={r.auditDays ?? ""} className={input} /></F>
        <F label="Statistiques détaillées (jours)" hint="Au-delà, seuls des compteurs journaliers anonymes sont conservés."><input name="analyticsRawDays" type="number" min={30} max={3650} required defaultValue={r.analyticsRawDays} className={input} /></F>
        <F label="Pièces comptables (années, information)" hint="Affiché dans la politique de confidentialité ; aucune purge automatique."><input name="accountingYears" type="number" min={1} max={30} defaultValue={r.accountingYears ?? ""} className={input} /></F>
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
  } else if (section === "prestation") {
    const v = s.service;
    body = (
      <form action={saveServiceAction} className="grid gap-4 sm:grid-cols-2">
        <F label="Délai de réalisation annoncé" hint="Ex. « 5 jours ouvrés après réception du brief complet »."><input name="deliveryDelay" defaultValue={v.deliveryDelay} maxLength={300} className={input} /></F>
        <F label="Politique de corrections" hint="Le nombre de séries incluses se règle par prestation dans « Plans et prestations »."><input name="revisionsPolicy" defaultValue={v.revisionsPolicy} maxLength={1000} className={input} /></F>
        <F label="Conditions de remboursement" wide><textarea name="refundPolicy" rows={3} defaultValue={v.refundPolicy} maxLength={2000} className={area} /></F>
        <F label="Conditions générales de la prestation" wide hint="Texte affiché sur la page publique et dans les conditions du service. Ligne vide = nouveau paragraphe ; **gras**, « - » pour une liste."><textarea name="conditions" rows={10} defaultValue={v.conditions} maxLength={10000} className={area} /></F>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="published" defaultChecked={v.published} className="h-4 w-4" /> Publier ces conditions (sinon, la page indique qu&apos;elles seront communiquées avant commande)</label>
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
  } else if (section.startsWith("legal-")) {
    const key = section.slice(6) as LegalPageKey;
    const p = s.legal[key];
    const path = { mentions: "/mentions-legales", confidentialite: "/confidentialite", conditions: "/conditions", cookies: "/cookies", sousTraitance: "/sous-traitance" }[key];
    body = (
      <form action={saveLegalAction} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="page" value={key} />
        <p className="text-sm text-muted sm:col-span-2">Par défaut, la page affiche un modèle alimenté par les réglages (société, durées, délai de grâce…), avec ses mentions « à compléter ». Collez ici le texte définitif rédigé ou relu par votre conseil : il remplacera le modèle. <Link href={path} target="_blank" className="font-semibold text-brand underline">Voir la page actuelle</Link></p>
        <F label="Texte définitif (facultatif)" wide hint="Ligne vide = nouveau paragraphe ; une ligne commençant par « ## » devient un titre ; **gras**, *italique*, « - » pour une liste. Aucun HTML."><textarea name="customText" rows={18} defaultValue={p.customText} maxLength={30000} className={`${area} font-mono`} /></F>
        <ValidationFields v={p} what="cette page" />
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
  } else if (section === "mesure") {
    const a = s.analytics;
    body = (
      <form action={saveAnalyticsAction} className="grid gap-4 sm:grid-cols-2">
        <F label="Régime de mesure d'audience des cartes" wide>
          <select name="mode" defaultValue={a.mode} className={input}>
            <option value="minimal">Mesure minimale sans traceur (sans bandeau)</option>
            <option value="consent">Mesure soumise au consentement préalable (bandeau Accepter / Refuser)</option>
            <option value="off">Aucune mesure</option>
          </select>
        </F>
        <p className="text-xs text-muted sm:col-span-2">La mesure minimale ne dépose ni cookie ni identifiant persistant et ne conserve pas d&apos;adresse IP. L&apos;exemption de consentement prévue par la CNIL pour la mesure d&apos;audience est conditionnelle : le choix du régime doit être validé. Un changement de régime invalide la validation précédente.</p>
        <F label="Note de validation (référence de l'avis, réserves)" wide><textarea name="note" rows={4} defaultValue={a.note} maxLength={2000} className={area} /></F>
        <ValidationFields v={a} what="ce régime de mesure" />
        <div><Button size="sm">Enregistrer</Button></div>
      </form>
    );
  }

  const status = (k: string) => {
    if (k.startsWith("legal-")) return s.legal[k.slice(6) as LegalPageKey].validated;
    if (k === "mesure") return s.analytics.validated;
    if (k === "societe") return missingCompanyFields(s).length === 0;
    if (k === "marque") return s.brand.publicUrl.startsWith("https://");
    if (k === "conservation") return s.retention.contentAfterEndDays !== null && s.retention.leadsDays !== null && s.retention.auditDays !== null;
    if (k === "prestation") return s.service.published;
    return null;
  };

  return (
    <>
      <PageHeader title="Réglages de la plateforme" description="Paramètres commerciaux et légaux, modifiables sans redéploiement. Chaque modification est journalisée (Journal d'audit). Les secrets (clés Stripe, SMTP, base) restent dans les variables d'environnement." />
      <Flash sp={sp} />
      {blockers.length > 0 && <div className="mb-4"><Alert tone="warning" title={`${blockers.length} point(s) de réglage avant le lancement`}><ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Sections des réglages" className="space-y-1">
          {SECTIONS.map(([k, label]) => {
            const st = status(k);
            return (
              <Link key={k} href={`/admin/reglages?section=${k}`} aria-current={section === k ? "page" : undefined} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${section === k ? "bg-brand-soft font-semibold text-brand" : "hover:bg-white"}`}>
                <span>{label}</span>
                {st === true && <Badge tone="success">OK</Badge>}
                {st === false && <Badge tone="warning">à faire</Badge>}
              </Link>
            );
          })}
        </nav>
        <Panel title={SECTIONS.find(([k]) => k === section)?.[1]}>{body}</Panel>
      </div>
    </>
  );
}

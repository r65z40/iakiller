"use client";

import { useId, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { CONTACT_KINDS, FONTS, LINK_ICONS, SOCIAL_NETWORKS } from "@/lib/cards/constants";
import type { CardBanner, CardBlock, CardIdentity, CardTheme, ContactKind } from "@/lib/cards/document";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { blockId } from "@/lib/cards/client-ids";
import { parseVideoUrl, normalizeWebUrl, normalizePhone, isValidEmail } from "@/lib/validation/urls";
import { inputClass } from "@/components/ui";
import { MediaPicker, type LibraryItem } from "./MediaPicker";

// ---------------------------------------------------------------------------
// Champs de base
// ---------------------------------------------------------------------------

export function TextInput({ label, value, onChange, maxLength = 80, placeholder, disabled, hint, type = "text", error, multiline, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; maxLength?: number; placeholder?: string; disabled?: boolean; hint?: ReactNode; type?: string; error?: string | null; multiline?: boolean; rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1 text-sm font-semibold">
        {label}
        {disabled && <Lock size={12} aria-label="verrouillé" className="text-muted" />}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} rows={rows} disabled={disabled} placeholder={placeholder} className={`${inputClass} py-2`} aria-invalid={!!error} />
      ) : (
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} disabled={disabled} placeholder={placeholder} className={inputClass} aria-invalid={!!error} />
      )}
      {error ? <p className="mt-1 text-xs font-semibold text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function SelectInput<T extends string>({ label, value, onChange, options, disabled }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; disabled?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1 text-sm font-semibold">{label}{disabled && <Lock size={12} aria-label="verrouillé" className="text-muted" />}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} disabled={disabled} className={inputClass}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Range({ label, value, min, max, step = 1, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="font-normal text-muted">{value}{unit}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[#0047BB]" />
    </div>
  );
}

function ColorInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1 text-sm font-semibold">{label}{disabled && <Lock size={12} aria-label="verrouillé" className="text-muted" />}</label>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} disabled={disabled} aria-label={`${label} (sélecteur)`} className="h-11 w-12 cursor-pointer rounded-lg border border-line bg-white p-1 disabled:cursor-not-allowed" />
        <input id={id} value={value} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v.toUpperCase()); }} disabled={disabled} maxLength={7} className={`${inputClass} mt-0 font-mono`} />
      </div>
    </div>
  );
}

/** Liste d'éléments avec ajout, suppression et réordonnancement accessible. */
function ItemList<T extends { id: string }>({ items, onChange, render, create, addLabel, max }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, update: (patch: Partial<T>) => void) => ReactNode; create: () => T; addLabel: string; max: number;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <fieldset key={item.id} className="rounded-lg border border-line p-3">
          <legend className="sr-only">Élément {i + 1}</legend>
          <div className="mb-2 flex justify-end gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter l'élément ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface disabled:opacity-30"><ArrowUp size={14} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Descendre l'élément ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface disabled:opacity-30"><ArrowDown size={14} /></button>
            <button type="button" onClick={() => onChange(items.filter((x) => x.id !== item.id))} aria-label={`Supprimer l'élément ${i + 1}`} className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-[#fdecea] hover:text-danger"><Trash2 size={14} /></button>
          </div>
          <div className="space-y-3">{render(item, (patch) => onChange(items.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}</div>
        </fieldset>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, create()])} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line text-sm font-semibold text-brand hover:bg-surface">
          <Plus size={16} aria-hidden /> {addLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneaux
// ---------------------------------------------------------------------------

export interface LockState {
  primaryColor: boolean;
  pageBackground: boolean;
  textColor: boolean;
  font: boolean;
  logo: boolean;
  company: boolean;
}

export function ThemePanel({ theme, onChange, locks }: { theme: CardTheme; onChange: (t: CardTheme) => void; locks: LockState }) {
  const set = <K extends keyof CardTheme>(k: K, v: CardTheme[K]) => onChange({ ...theme, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Modèle</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {Object.entries(TEMPLATE_PRESETS).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={theme.template === id} onClick={() => onChange({ ...theme, ...t.theme })}
              className={`rounded-lg p-2 text-left text-xs ring-1 ${theme.template === id ? "bg-brand-soft ring-2 ring-brand" : "ring-line hover:bg-surface"}`}>
              <span className="block text-sm font-bold">{t.label}</span>
              <span className="text-muted">{t.description}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Changer de modèle conserve tout le contenu.</p>
      </div>
      <ColorInput label="Couleur principale" value={theme.primaryColor} onChange={(v) => set("primaryColor", v)} disabled={locks.primaryColor} />
      <ColorInput label="Fond de page" value={theme.pageBackground} onChange={(v) => set("pageBackground", v)} disabled={locks.pageBackground} />
      <ColorInput label="Fond de la carte" value={theme.cardBackground} onChange={(v) => set("cardBackground", v)} />
      <ColorInput label="Texte" value={theme.textColor} onChange={(v) => set("textColor", v)} disabled={locks.textColor} />
      <ColorInput label="Texte secondaire" value={theme.mutedColor} onChange={(v) => set("mutedColor", v)} />
      <ColorInput label="Texte des boutons principaux" value={theme.buttonTextColor} onChange={(v) => set("buttonTextColor", v)} />
      <ContrastHint fg={theme.textColor} bg={theme.cardBackground} label="Texte / fond de carte" />
      <ContrastHint fg={theme.buttonTextColor} bg={theme.primaryColor} label="Boutons principaux" />
      <SelectInput label="Police" value={theme.font} onChange={(v) => set("font", v)} disabled={locks.font} options={Object.entries(FONTS).map(([value, f]) => ({ value: value as CardTheme["font"], label: f.label }))} />
      <SelectInput label="Taille du nom" value={theme.nameSize} onChange={(v) => set("nameSize", v)} options={[{ value: "sm", label: "Petite" }, { value: "md", label: "Moyenne" }, { value: "lg", label: "Grande" }]} />
      <SelectInput label="Style des boutons" value={theme.buttonStyle} onChange={(v) => set("buttonStyle", v)} options={[{ value: "soft", label: "Doux (teinté)" }, { value: "filled", label: "Plein" }, { value: "outline", label: "Contour" }]} />
      <SelectInput label="Alignement de l'en-tête" value={theme.align} onChange={(v) => set("align", v)} options={[{ value: "center", label: "Centré" }, { value: "left", label: "À gauche" }]} />
      <SelectInput label="Espacement" value={theme.spacing} onChange={(v) => set("spacing", v)} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "airy", label: "Aéré" }]} />
      <Range label="Arrondi des coins" value={theme.radius} min={0} max={28} onChange={(v) => set("radius", v)} unit=" px" />
      <Range label="Bordure des boutons" value={theme.borderWidth} min={0} max={2} onChange={(v) => set("borderWidth", v)} unit=" px" />
    </div>
  );
}

function luminance(hex: string) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function ContrastHint({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const ratio = contrastRatio(fg, bg);
  if (ratio >= 4.5) return null;
  return <p className="rounded-lg bg-[#fff6e6] p-2 text-xs text-[#7a3d00]">Contraste insuffisant ({label} : {ratio.toFixed(1)}:1, 4,5:1 recommandé). Le texte risque d&apos;être difficile à lire.</p>;
}

export function IdentityPanel({ identity, onChange, locks, library, onUploaded }: { identity: CardIdentity; onChange: (i: CardIdentity) => void; locks: LockState; library: LibraryItem[]; onUploaded: (m: LibraryItem) => void }) {
  const set = <K extends keyof CardIdentity>(k: K, v: CardIdentity[K]) => onChange({ ...identity, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Prénom" value={identity.firstName} onChange={(v) => set("firstName", v)} maxLength={60} />
        <TextInput label="Nom" value={identity.lastName} onChange={(v) => set("lastName", v)} maxLength={60} />
      </div>
      <TextInput label="Fonction" value={identity.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="Ex. Responsable commerciale" />
      <TextInput label="Société" value={identity.company} onChange={(v) => set("company", v)} disabled={locks.company} />
      <MediaPicker kind="image" cropAspect={1} label="Photo de profil" library={library} value={identity.photoMediaId} onChange={(v) => set("photoMediaId", v)} onUploaded={onUploaded} />
      <Toggle label="Afficher la photo" checked={identity.showPhoto} onChange={(v) => set("showPhoto", v)} />
      <MediaPicker kind="image" cropAspect={1} label="Logo" library={library} value={identity.logoMediaId} onChange={(v) => set("logoMediaId", v)} onUploaded={onUploaded} disabled={locks.logo} />
      <Toggle label="Afficher le logo" checked={identity.showLogo} onChange={(v) => set("showLogo", v)} />
    </div>
  );
}

export function BannerPanel({ banner, onChange, library, onUploaded }: { banner: CardBanner; onChange: (b: CardBanner) => void; library: LibraryItem[]; onUploaded: (m: LibraryItem) => void }) {
  const set = <K extends keyof CardBanner>(k: K, v: CardBanner[K]) => onChange({ ...banner, [k]: v });
  return (
    <div className="space-y-4">
      <MediaPicker kind="image" cropAspect={2.85} label="Image de bannière" library={library} value={banner.mediaId} onChange={(v) => set("mediaId", v)} onUploaded={onUploaded} />
      <p className="text-xs text-muted">Sans image, la bannière utilise un dégradé de la couleur principale. N&apos;utilisez que des photos dont vous détenez les droits.</p>
      <Range label="Hauteur" value={banner.height} min={80} max={240} onChange={(v) => set("height", v)} unit=" px" />
      <Range label="Point focal horizontal" value={banner.focalX} min={0} max={100} onChange={(v) => set("focalX", v)} unit=" %" />
      <Range label="Point focal vertical" value={banner.focalY} min={0} max={100} onChange={(v) => set("focalY", v)} unit=" %" />
      <Range label="Flou" value={banner.blur} min={0} max={12} step={0.5} onChange={(v) => set("blur", v)} unit=" px" />
      <Range label="Voile blanc" value={banner.veilOpacity} min={0} max={90} onChange={(v) => set("veilOpacity", v)} unit=" %" />
    </div>
  );
}

const CONTACT_LABELS: Record<ContactKind, string> = { mobile: "Mobile", landline: "Téléphone fixe", email: "Email", whatsapp: "WhatsApp", sms: "SMS", address: "Adresse", website: "Site web" };
const NETWORK_LABELS: Record<(typeof SOCIAL_NETWORKS)[number], string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", x: "X", youtube: "YouTube", tiktok: "TikTok", other: "Autre" };
const ICON_LABELS: Record<(typeof LINK_ICONS)[number], string> = { web: "Site web (www)", linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", calendar: "Calendrier", document: "Document", shop: "Boutique", star: "Étoile (avis)", link: "Lien" };

function contactError(kind: ContactKind, value: string): string | null {
  if (!value.trim()) return null;
  if (kind === "email") return isValidEmail(value) ? null : "Adresse email invalide.";
  if (kind === "website") return normalizeWebUrl(value) ? null : "Adresse web invalide.";
  if (kind === "address") return null;
  return normalizePhone(value) ? null : "Numéro invalide.";
}

function urlError(v: string) {
  return v && !normalizeWebUrl(v) ? "Adresse web invalide (http ou https)." : null;
}

export function BlockPanel({ block, onChange, library, onUploaded }: { block: CardBlock; onChange: (b: CardBlock) => void; library: LibraryItem[]; onUploaded: (m: LibraryItem) => void }) {
  const titleField = "title" in block && (
    <TextInput label="Titre de la section" value={block.title} onChange={(v) => onChange({ ...block, title: v } as CardBlock)} maxLength={60} hint="Laissez vide pour masquer le titre." />
  );

  switch (block.type) {
    case "actions":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted">Les boutons utilisent le premier mobile (ou fixe) et le premier email du bloc Coordonnées.</p>
          <Toggle label="Bouton « Appeler »" checked={block.showCall} onChange={(v) => onChange({ ...block, showCall: v })} />
          <TextInput label="Libellé appel" value={block.callLabel} onChange={(v) => onChange({ ...block, callLabel: v })} maxLength={40} hint="« Appeler » est complété par votre prénom." />
          <Toggle label="Bouton « Envoyer un mail »" checked={block.showEmail} onChange={(v) => onChange({ ...block, showEmail: v })} />
          <TextInput label="Libellé email" value={block.emailLabel} onChange={(v) => onChange({ ...block, emailLabel: v })} maxLength={40} />
          <Toggle label="Bouton « Ajouter aux contacts » (vCard)" checked={block.showVcard} onChange={(v) => onChange({ ...block, showVcard: v })} />
          <Toggle label="Boutons Apple Wallet / Google Wallet (si activés par la plateforme)" checked={block.showWallet} onChange={(v) => onChange({ ...block, showWallet: v })} />
          <TextInput label="Libellé contact" value={block.vcardLabel} onChange={(v) => onChange({ ...block, vcardLabel: v })} maxLength={40} />
        </div>
      );
    case "contacts":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={20} addLabel="Ajouter une coordonnée" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), kind: "mobile" as ContactKind, label: "", value: "" })}
            render={(item, update) => (
              <>
                <SelectInput label="Type" value={item.kind} onChange={(v) => update({ kind: v })} options={CONTACT_KINDS.map((k) => ({ value: k, label: CONTACT_LABELS[k] }))} />
                <TextInput label="Libellé (facultatif)" value={item.label} onChange={(v) => update({ label: v })} placeholder={`Ex. ${CONTACT_LABELS[item.kind]} · Bureau`} />
                <TextInput label="Valeur" value={item.value} onChange={(v) => update({ value: v })} maxLength={300} multiline={item.kind === "address"} rows={3}
                  type={item.kind === "email" ? "email" : item.kind === "website" ? "url" : item.kind === "address" ? "text" : "tel"} error={contactError(item.kind, item.value)} />
              </>
            )}
          />
        </div>
      );
    case "about":
      return (
        <div className="space-y-4">
          {titleField}
          <TextInput label="Texte" value={block.text} onChange={(v) => onChange({ ...block, text: v })} maxLength={2000} multiline rows={6}
            hint="Ligne vide = nouveau paragraphe. **gras**, *italique*, « - » en début de ligne pour une liste." />
          <TextInput label="Étiquettes (séparées par des virgules)" value={block.tags.join(", ")} onChange={(v) => onChange({ ...block, tags: v.split(",").map((t) => t.trimStart()).slice(0, 20) })} maxLength={800} />
        </div>
      );
    case "links":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={20} addLabel="Ajouter un lien" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), title: "", subtitle: "", url: "", icon: "link" as (typeof LINK_ICONS)[number] })}
            render={(item, update) => (
              <>
                <TextInput label="Titre" value={item.title} onChange={(v) => update({ title: v })} maxLength={60} />
                <TextInput label="Sous-titre (facultatif)" value={item.subtitle} onChange={(v) => update({ subtitle: v })} maxLength={100} />
                <TextInput label="Adresse" type="url" value={item.url} onChange={(v) => update({ url: v })} maxLength={2048} placeholder="https://" error={urlError(item.url)} />
                <SelectInput label="Icône" value={item.icon} onChange={(v) => update({ icon: v })} options={LINK_ICONS.map((i) => ({ value: i, label: ICON_LABELS[i] }))} />
              </>
            )}
          />
        </div>
      );
    case "social":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={12} addLabel="Ajouter un réseau" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), network: "linkedin" as (typeof SOCIAL_NETWORKS)[number], label: "", url: "" })}
            render={(item, update) => (
              <>
                <SelectInput label="Réseau" value={item.network} onChange={(v) => update({ network: v })} options={SOCIAL_NETWORKS.map((n) => ({ value: n, label: NETWORK_LABELS[n] }))} />
                <TextInput label="Libellé (facultatif)" value={item.label} onChange={(v) => update({ label: v })} placeholder="Ex. Suivez nos actualités" />
                <TextInput label="Adresse du profil" type="url" value={item.url} onChange={(v) => update({ url: v })} maxLength={2048} placeholder="https://" error={urlError(item.url)} />
              </>
            )}
          />
        </div>
      );
    case "gallery":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={24} addLabel="Ajouter une photo" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), mediaId: library.find((m) => m.kind === "image")?.id ?? "", caption: "" })}
            render={(item, update) => (
              <>
                <MediaPicker kind="image" cropAspect={4 / 3} label="Photo" allowNone={false} library={library} value={item.mediaId || null} onChange={(v) => v && update({ mediaId: v })} onUploaded={onUploaded} />
                <TextInput label="Légende (facultatif)" value={item.caption} onChange={(v) => update({ caption: v })} maxLength={120} />
              </>
            )}
          />
          {block.items.some((i) => !i.mediaId) && <p className="text-xs font-semibold text-danger">Choisissez une image pour chaque élément.</p>}
        </div>
      );
    case "video": {
      const current = block.provider && block.videoId ? (block.provider === "youtube" ? `https://youtu.be/${block.videoId}` : `https://vimeo.com/${block.videoId}`) : "";
      return (
        <div className="space-y-4">
          {titleField}
          <VideoUrlField current={current} onParsed={(p) => onChange({ ...block, provider: p?.provider ?? null, videoId: p?.videoId ?? "" })} />
          <p className="text-xs text-muted">La vidéo n&apos;est chargée qu&apos;au clic du visiteur, qui est informé que le service vidéo peut déposer ses propres traceurs.</p>
        </div>
      );
    }
    case "documents":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={12} addLabel="Ajouter un PDF" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), mediaId: library.find((m) => m.kind === "document")?.id ?? "", title: "" })}
            render={(item, update) => (
              <>
                <MediaPicker kind="document" label="Fichier PDF" allowNone={false} library={library} value={item.mediaId || null} onChange={(v) => v && update({ mediaId: v })} onUploaded={onUploaded} />
                <TextInput label="Nom affiché" value={item.title} onChange={(v) => update({ title: v })} maxLength={100} placeholder="Ex. Plaquette 2026" />
              </>
            )}
          />
          {block.items.some((i) => !i.mediaId) && <p className="text-xs font-semibold text-danger">Choisissez un PDF pour chaque élément.</p>}
        </div>
      );
    case "reviews":
      return (
        <div className="space-y-4">
          {titleField}
          <SelectInput label="Plateforme" value={block.platform} onChange={(v) => onChange({ ...block, platform: v })} options={[{ value: "google", label: "Google (fiche d'établissement)" }, { value: "other", label: "Autre plateforme" }]} />
          {block.platform === "other" && <TextInput label="Nom de la plateforme" value={block.platformName} onChange={(v) => onChange({ ...block, platformName: v })} maxLength={40} placeholder="Ex. Trustpilot" />}
          <TextInput label="Lien pour lire les avis" type="url" value={block.readUrl} onChange={(v) => onChange({ ...block, readUrl: v })} maxLength={2048} placeholder="https://" error={urlError(block.readUrl)}
            hint={block.platform === "google" ? "Depuis votre fiche Google : « Avis » puis copier le lien de la page." : undefined} />
          <TextInput label="Lien pour laisser un avis" type="url" value={block.writeUrl} onChange={(v) => onChange({ ...block, writeUrl: v })} maxLength={2048} placeholder="https://" error={urlError(block.writeUrl)}
            hint={block.platform === "google" ? "Dans Google Business Profile : « Demander des avis » fournit ce lien." : undefined} />
          <TextInput label="Phrase d'introduction (facultatif)" value={block.intro} onChange={(v) => onChange({ ...block, intro: v })} maxLength={200} />
          <p className="text-xs text-muted">Pour garantir la sincérité des avis, la carte ne contient que des liens : aucun texte d&apos;avis ni note ne peut être saisi ici.</p>
        </div>
      );
    case "appointment":
      return (
        <div className="space-y-4">
          {titleField}
          <TextInput label="Texte du bouton" value={block.label} onChange={(v) => onChange({ ...block, label: v })} maxLength={60} />
          <TextInput label="Lien de réservation" type="url" value={block.url} onChange={(v) => onChange({ ...block, url: v })} maxLength={2048} placeholder="https://" error={urlError(block.url)} hint="Lien vers votre outil de prise de rendez-vous (Calendly, Doctolib, Google Agenda…)." />
          <TextInput label="Précision (facultatif)" value={block.note} onChange={(v) => onChange({ ...block, note: v })} maxLength={200} />
        </div>
      );
    case "hours":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.rows} max={14} addLabel="Ajouter une ligne" onChange={(rows) => onChange({ ...block, rows })}
            create={() => ({ id: blockId(), day: "", value: "" })}
            render={(row, update) => (
              <div className="grid grid-cols-2 gap-2">
                <TextInput label="Jours" value={row.day} onChange={(v) => update({ day: v })} maxLength={40} />
                <TextInput label="Horaires" value={row.value} onChange={(v) => update({ value: v })} maxLength={80} />
              </div>
            )}
          />
          <TextInput label="Remarque (facultatif)" value={block.note} onChange={(v) => onChange({ ...block, note: v })} maxLength={200} placeholder="Ex. Fermé les jours fériés" />
        </div>
      );
    case "services":
      return (
        <div className="space-y-4">
          {titleField}
          <ItemList items={block.items} max={20} addLabel="Ajouter un service" onChange={(items) => onChange({ ...block, items })}
            create={() => ({ id: blockId(), name: "", description: "" })}
            render={(item, update) => (
              <>
                <TextInput label="Service" value={item.name} onChange={(v) => update({ name: v })} maxLength={80} />
                <TextInput label="Description (facultatif)" value={item.description} onChange={(v) => update({ description: v })} maxLength={240} multiline rows={2} />
              </>
            )}
          />
        </div>
      );
    case "leadForm": {
      const modes = [{ value: "off" as const, label: "Non demandé" }, { value: "optional" as const, label: "Facultatif" }, { value: "required" as const, label: "Obligatoire" }];
      const setField = (k: keyof typeof block.fields, v: "off" | "optional" | "required") => onChange({ ...block, fields: { ...block.fields, [k]: v } });
      return (
        <div className="space-y-4">
          {titleField}
          <TextInput label="Introduction" value={block.intro} onChange={(v) => onChange({ ...block, intro: v })} maxLength={300} multiline rows={2} />
          <TextInput label="Texte du bouton" value={block.buttonLabel} onChange={(v) => onChange({ ...block, buttonLabel: v })} maxLength={40} />
          <SelectInput label="Nom" value={block.fields.name} onChange={(v) => setField("name", v)} options={modes} />
          <SelectInput label="Email" value={block.fields.email} onChange={(v) => setField("email", v)} options={modes} />
          <SelectInput label="Téléphone" value={block.fields.phone} onChange={(v) => setField("phone", v)} options={modes} />
          <SelectInput label="Société" value={block.fields.company} onChange={(v) => setField("company", v)} options={modes} />
          <SelectInput label="Message" value={block.fields.message} onChange={(v) => setField("message", v)} options={modes} />
          {block.fields.email === "off" && block.fields.phone === "off" && <p className="text-xs font-semibold text-danger">Demandez au moins un email ou un téléphone.</p>}
          <p className="text-xs text-muted">Collectez uniquement ce qui est nécessaire pour recontacter. Le visiteur est informé que ses données vous sont destinées ; la case d&apos;accord marketing est séparée et décochée par défaut.</p>
        </div>
      );
    }
  }
}

function VideoUrlField({ current, onParsed }: { current: string; onParsed: (p: ReturnType<typeof parseVideoUrl>) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">Adresse de la vidéo YouTube ou Vimeo</label>
      <input id={id} defaultValue={current} placeholder="https://www.youtube.com/watch?v=…" className={inputClass}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (!v) onParsed(null);
          else {
            const p = parseVideoUrl(v);
            if (p) onParsed(p);
          }
        }} />
      <p className="mt-1 text-xs text-muted">{current ? "Vidéo reconnue." : "Aucun code d'intégration HTML n'est accepté : collez simplement l'adresse."}</p>
    </div>
  );
}

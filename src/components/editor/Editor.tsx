"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, CloudOff, Loader2, Monitor, Plus, Redo2, Smartphone, Undo2 } from "lucide-react";
import type { CardBlock, CardDocument } from "@/lib/cards/document";
import { BLOCK_LIBRARY, blockLabel, newBlock } from "@/lib/cards/defaults";
import { blockId } from "@/lib/cards/client-ids";
import { CardView, type MediaInfo } from "@/components/card/CardView";
import { buttonClass } from "@/components/ui";
import { publishCardAction, renameCardSlugAction, setQrStyleAction, setQrVariantsAction, restoreVersionAction, setCardAssigneesAction, unpublishCardAction } from "@/app/app/_actions/cards";
import { BlockList } from "./BlockList";
import { BannerPanel, BlockPanel, IdentityPanel, ThemePanel, type LockState } from "./panels";
import type { LibraryItem } from "./MediaPicker";
import { useAutosave, type SaveStatus } from "./useAutosave";

export interface EditorProps {
  card: { id: string; title: string; status: string; slug: string; revision: number; publishedAt: string | null; disabled: boolean; hasUnpublishedChanges: boolean; qrStyle: { dark: string; logo: "none" | "card" | "brand" }; qrVariants: QrVariantT[] };
  qrScans: Record<string, number>;
  initialDoc: CardDocument;
  library: LibraryItem[];
  locks: LockState;
  publicBase: string;
  qrShortUrl: string;
  versions: { id: string; number: number; createdAt: string }[];
  canManage: boolean;
  canPublish: boolean;
  publishBlockedReason: string | null;
  members: { userId: string; name: string; email: string }[];
  assignees: string[];
  wallet: { apple?: string; google?: string };
  /** Mini-sites publiés de l'organisation (destinations possibles d'un QR intelligent). */
  sites: { slug: string; title: string }[];
}

type Selection = string | "identity" | "banner" | "theme" | "settings" | "qr" | "versions" | null;

function StatusIndicator({ status, savedAt, error }: { status: SaveStatus; savedAt: Date | null; error: string | null }) {
  const content = {
    saved: <><Check size={14} aria-hidden /> {savedAt ? `Brouillon enregistré à ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Brouillon à jour"}</>,
    dirty: <>Modifications non enregistrées…</>,
    saving: <><Loader2 size={14} className="animate-spin" aria-hidden /> Enregistrement…</>,
    error: <><CloudOff size={14} aria-hidden /> {error}</>,
    invalid: <><AlertTriangle size={14} aria-hidden /> {error ?? "Valeurs invalides"}</>,
    conflict: <><AlertTriangle size={14} aria-hidden /> Conflit de modification</>,
  }[status];
  const tone = status === "error" || status === "invalid" || status === "conflict" ? "text-danger" : "text-muted";
  return <p aria-live="polite" className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>{content}</p>;
}

export function Editor(props: EditorProps) {
  const [doc, setDoc] = useState<CardDocument>(props.initialDoc);
  const [title, setTitle] = useState(props.card.title);
  const [selection, setSelection] = useState<Selection>("identity");
  const [library, setLibrary] = useState<LibraryItem[]>(props.library);
  const [mobileTab, setMobileTab] = useState<"blocks" | "preview" | "props">("blocks");
  const [undo, setUndo] = useState<{ block: CardBlock; index: number } | null>(null);
  const [status, setPublishStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [cardStatus, setCardStatus] = useState(props.card.status);
  const [unpublished, setUnpublished] = useState(props.card.hasUnpublishedChanges);
  const [publishing, startPublish] = useTransition();
  const autosave = useAutosave(props.card.id, props.card.revision);

  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  // Historique d'annulation : les modifications rapprochées (frappe) forment une seule étape.
  const past = useRef<CardDocument[]>([]);
  const future = useRef<CardDocument[]>([]);
  const lastPush = useRef(0);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  const syncHistory = () => setHistorySize({ undo: past.current.length, redo: future.current.length });

  const apply = useCallback(
    (next: CardDocument, nextTitle = title) => {
      setDoc(next);
      setUnpublished(true);
      autosave.schedule(next, nextTitle);
    },
    [autosave, title],
  );

  const commit = useCallback(
    (next: CardDocument, nextTitle = title) => {
      const now = Date.now();
      if (now - lastPush.current > 800 || past.current.length === 0) {
        past.current = [...past.current.slice(-99), doc];
      }
      lastPush.current = now;
      future.current = [];
      syncHistory();
      apply(next, nextTitle);
    },
    [apply, doc, title],
  );

  const undoChange = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [...future.current, doc];
    lastPush.current = 0;
    syncHistory();
    apply(prev);
  }, [apply, doc]);

  const redoChange = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current = [...past.current, doc];
    lastPush.current = 0;
    syncHistory();
    apply(next);
  }, [apply, doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Dans un champ de saisie, l'annulation native du navigateur reste prioritaire.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoChange();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redoChange();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoChange, redoChange]);
  const canUndo = historySize.undo > 0;
  const canRedo = historySize.redo > 0;

  const updateBlock = (b: CardBlock) => commit({ ...doc, blocks: doc.blocks.map((x) => (x.id === b.id ? b : x)) });

  const addBlock = (type: CardBlock["type"]) => {
    if (type === "leadForm" && doc.blocks.some((b) => b.type === "leadForm")) {
      setPublishStatus({ tone: "danger", text: "Un seul formulaire de contact par carte." });
      return;
    }
    const b = newBlock(type);
    commit({ ...doc, blocks: [...doc.blocks, b] });
    setSelection(b.id);
    setMobileTab("props");
  };

  const deleteBlock = (id: string) => {
    const index = doc.blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    setUndo({ block: doc.blocks[index], index });
    commit({ ...doc, blocks: doc.blocks.filter((b) => b.id !== id) });
    if (selection === id) setSelection(null);
  };

  const restoreDeleted = () => {
    if (!undo) return;
    const blocks = [...doc.blocks];
    blocks.splice(Math.min(undo.index, blocks.length), 0, undo.block);
    commit({ ...doc, blocks });
    setSelection(undo.block.id);
    setUndo(null);
  };

  const duplicateBlock = (id: string) => {
    const index = doc.blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    const source = doc.blocks[index];
    if (source.type === "leadForm") return;
    const copy = structuredClone(source);
    copy.id = blockId();
    if ("items" in copy) (copy.items as { id: string }[]).forEach((i) => (i.id = blockId()));
    if (copy.type === "hours") copy.rows.forEach((r) => (r.id = blockId()));
    const blocks = [...doc.blocks];
    blocks.splice(index + 1, 0, copy);
    commit({ ...doc, blocks });
    setSelection(copy.id);
  };

  const mediaMap = useMemo(() => {
    const map: Record<string, MediaInfo> = {};
    for (const m of library) map[m.id] = { url: m.url, name: m.name, sizeBytes: m.sizeBytes, width: m.width, height: m.height };
    return map;
  }, [library]);

  const onUploaded = (m: LibraryItem) => setLibrary((l) => [m, ...l.filter((x) => x.id !== m.id)]);

  const publish = () =>
    startPublish(async () => {
      setPublishStatus(null);
      const saved = await autosave.flush();
      if (!saved && autosave.hasPending()) {
        setPublishStatus({ tone: "danger", text: "Enregistrez d'abord le brouillon (voir l'état d'enregistrement)." });
        return;
      }
      const res = await publishCardAction(props.card.id);
      if (res.ok) {
        setCardStatus("published");
        setUnpublished(false);
        setPublishStatus({ tone: "success", text: `Version ${res.data.number} publiée. La carte publique est à jour.` });
      } else setPublishStatus({ tone: "danger", text: res.error });
    });

  const selectedBlock = doc.blocks.find((b) => b.id === selection) ?? null;
  const publicUrl = `${props.publicBase}/${props.card.slug}`;

  const navButton = (id: Selection, label: string) => (
    <button type="button" onClick={() => { setSelection(id); setMobileTab("props"); }} aria-pressed={selection === id}
      className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-semibold ring-1 ${selection === id ? "bg-brand-soft text-brand ring-brand" : "bg-white ring-line hover:bg-surface"}`}>
      {label}
    </button>
  );

  const leftPanel = (
    <div className="space-y-5">
      <div className="space-y-2">
        {navButton("identity", "En-tête et identité")}
        {navButton("banner", "Bannière")}
        {navButton("theme", "Apparence et modèle")}
      </div>
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Blocs de la carte</h2>
        <BlockList
          blocks={doc.blocks}
          selectedId={selectedBlock?.id ?? null}
          onSelect={(id) => { setSelection(id); setMobileTab("props"); }}
          onReorder={(blocks) => commit({ ...doc, blocks })}
          onToggle={(id) => commit({ ...doc, blocks: doc.blocks.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)) })}
          onDuplicate={duplicateBlock}
          onDelete={deleteBlock}
        />
        {undo && (
          <div role="status" className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-ink px-3 py-2 text-sm text-white">
            <span>Bloc « {blockLabel(undo.block.type)} » supprimé.</span>
            <button type="button" onClick={restoreDeleted} className="font-bold underline">Annuler la suppression</button>
          </div>
        )}
      </div>
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Ajouter un bloc</h2>
        <ul className="grid grid-cols-2 gap-2">
          {BLOCK_LIBRARY.map((b) => (
            <li key={b.type}>
              <button type="button" onClick={() => addBlock(b.type)} title={b.description}
                className="flex min-h-11 w-full items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-left text-xs font-semibold ring-1 ring-line hover:bg-surface">
                <Plus size={14} className="shrink-0 text-brand" aria-hidden />
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 border-t border-line pt-4">
        {navButton("qr", "QR code et partage")}
        {navButton("versions", "Versions publiées")}
        {props.canManage && navButton("settings", "Adresse et attribution")}
      </div>
    </div>
  );

  let propsPanel: React.ReactNode = <p className="text-sm text-muted">Sélectionnez un élément à modifier, dans la liste ou directement dans l&apos;aperçu.</p>;
  let propsTitle = "Propriétés";
  if (selection === "identity") {
    propsTitle = "En-tête et identité";
    propsPanel = <IdentityPanel identity={doc.identity} onChange={(identity) => commit({ ...doc, identity })} locks={props.locks} library={library} onUploaded={onUploaded} />;
  } else if (selection === "banner") {
    propsTitle = "Bannière";
    propsPanel = <BannerPanel banner={doc.banner} onChange={(banner) => commit({ ...doc, banner })} library={library} onUploaded={onUploaded} />;
  } else if (selection === "theme") {
    propsTitle = "Apparence";
    propsPanel = <ThemePanel theme={doc.theme} onChange={(theme) => commit({ ...doc, theme })} locks={props.locks} />;
  } else if (selection === "qr") {
    propsTitle = "QR code et partage";
    propsPanel = <QrPanel cardId={props.card.id} shortUrl={props.qrShortUrl} publicUrl={publicUrl} published={cardStatus === "published"} initialStyle={props.card.qrStyle} initialVariants={props.card.qrVariants} sections={doc.blocks.filter((b) => !b.hidden).map((b) => ({ id: b.id, label: blockLabel(b.type) }))} sites={props.sites} scans={props.qrScans} />;
  } else if (selection === "versions") {
    propsTitle = "Versions publiées";
    propsPanel = <VersionsPanel cardId={props.card.id} versions={props.versions} flush={autosave.flush} />;
  } else if (selection === "settings") {
    propsTitle = "Adresse et attribution";
    propsPanel = <SettingsPanel cardId={props.card.id} slug={props.card.slug} publicBase={props.publicBase} members={props.members} assignees={props.assignees} />;
  } else if (selectedBlock) {
    propsTitle = blockLabel(selectedBlock.type);
    propsPanel = <BlockPanel key={selectedBlock.id} block={selectedBlock} onChange={updateBlock} library={library} onUploaded={onUploaded} />;
  }

  return (
    <div className="-mx-4 -my-6 sm:-mx-8">
      {/* Barre d'outils */}
      <div className="sticky top-0 z-20 border-b border-line bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="card-title" className="sr-only">Nom interne de la carte</label>
            <input id="card-title" value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setUnpublished(true); autosave.schedule(doc, e.target.value); }}
              className="w-full max-w-md rounded-md border border-transparent px-1 text-lg font-bold hover:border-line focus:border-brand" />
            <div className="flex flex-wrap items-center gap-x-3 px-1">
              <StatusIndicator status={autosave.status} savedAt={autosave.savedAt} error={autosave.error} />
              <span className="text-xs text-muted">
                {cardStatus === "published" ? (unpublished ? "Publiée · modifications non publiées" : "Publiée · à jour") : "Jamais publiée"}
                {props.card.disabled && " · désactivée"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Historique des modifications">
            <button type="button" onClick={undoChange} disabled={!canUndo} aria-keyshortcuts="Control+Z" title="Annuler (Ctrl+Z)" className={buttonClass("ghost", "sm")}><Undo2 size={16} aria-hidden /><span className="sr-only sm:not-sr-only">Annuler</span></button>
            <button type="button" onClick={redoChange} disabled={!canRedo} aria-keyshortcuts="Control+Shift+Z" title="Rétablir (Ctrl+Maj+Z)" className={buttonClass("ghost", "sm")}><Redo2 size={16} aria-hidden /><span className="sr-only sm:not-sr-only">Rétablir</span></button>
          </div>
          {cardStatus === "published" && !props.card.disabled && (
            <a href={publicUrl} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>Voir la carte publique</a>
          )}
          {cardStatus === "published" && (
            <button type="button" className={buttonClass("ghost", "sm")} onClick={async () => {
              if (!window.confirm("Retirer la carte de la publication ? Elle deviendra indisponible pour les visiteurs.")) return;
              const r = await unpublishCardAction(props.card.id);
              if (r.ok) { setCardStatus("draft"); setPublishStatus({ tone: "success", text: r.data }); }
            }}>Dépublier</button>
          )}
          <button type="button" onClick={publish} disabled={publishing || !props.canPublish} className={buttonClass("primary", "sm")} title={props.publishBlockedReason ?? undefined}>
            {publishing ? "Publication…" : cardStatus === "published" ? "Publier les modifications" : "Publier"}
          </button>
        </div>
        {!props.canPublish && props.publishBlockedReason && <p className="mt-2 text-xs font-semibold text-warning">{props.publishBlockedReason}</p>}
        {status && <p role={status.tone === "danger" ? "alert" : "status"} className={`mt-2 text-sm font-semibold ${status.tone === "danger" ? "text-danger" : "text-success"}`}>{status.text}</p>}
        {autosave.status === "conflict" && (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-[#fdecea] p-3 text-sm text-[#7a1a12]">
            <span>Cette carte a été modifiée ailleurs (autre onglet ou autre personne). Vos dernières modifications ne sont pas enregistrées.</span>
            <button type="button" className="font-bold underline" onClick={() => window.location.reload()}>Recharger la version enregistrée</button>
            <button type="button" className="font-bold underline" onClick={() => void autosave.overwrite()}>Conserver ma version</button>
          </div>
        )}
        {autosave.status === "error" && (
          <button type="button" className="mt-2 text-sm font-bold text-brand underline" onClick={() => void autosave.flush()}>Réessayer maintenant</button>
        )}
        {/* Onglets mobiles */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-surface p-1 lg:hidden" role="tablist" aria-label="Vue de l'éditeur">
          {([["blocks", "Blocs"], ["preview", "Aperçu"], ["props", "Propriétés"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mobileTab === id} onClick={() => setMobileTab(id)}
              className={`min-h-9 rounded-md text-sm font-semibold ${mobileTab === id ? "bg-white shadow-sm" : "text-muted"}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className={`${mobileTab === "blocks" ? "block" : "hidden"} border-r border-line bg-surface p-4 lg:block lg:h-[calc(100dvh-90px)] lg:overflow-y-auto`} aria-label="Structure de la carte">
          {leftPanel}
        </aside>
        <section className={`${mobileTab === "preview" ? "block" : "hidden"} p-4 lg:block lg:h-[calc(100dvh-90px)] lg:overflow-y-auto`} aria-label="Aperçu" style={{ background: doc.theme.pageBackground }}>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
            <div role="radiogroup" aria-label="Format de l'aperçu" className="inline-flex rounded-lg bg-white/80 p-1 ring-1 ring-line">
              {([["phone", "Téléphone", Smartphone], ["desktop", "Ordinateur", Monitor]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="radio" aria-checked={device === id} onClick={() => setDevice(id)}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${device === id ? "bg-ink text-white" : "text-muted"}`}>
                  <Icon size={14} aria-hidden />{label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Aperçu du brouillon · cliquez sur un élément pour le modifier</p>
          </div>
          {device === "phone" ? (
            <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[40px] border-[10px] border-ink bg-[var(--preview-bg)] shadow-xl" style={{ ["--preview-bg" as string]: doc.theme.pageBackground }}>
              <div className="h-[720px] overflow-y-auto px-2 py-3">
                <CardView doc={doc} media={mediaMap} wallet={props.wallet} mode="preview" highlightBlockId={selection} onSelectBlock={(id) => { setSelection(id); setMobileTab("props"); }} />
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[1100px] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-line">
              <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-2" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 truncate rounded bg-white px-2 py-0.5 text-[11px] text-muted">{publicUrl}</span>
              </div>
              <div className="px-4 py-10" style={{ background: doc.theme.pageBackground }}>
                <CardView doc={doc} media={mediaMap} wallet={props.wallet} mode="preview" highlightBlockId={selection} onSelectBlock={(id) => { setSelection(id); setMobileTab("props"); }} />
              </div>
            </div>
          )}
        </section>
        <aside className={`${mobileTab === "props" ? "block" : "hidden"} border-l border-line bg-white p-4 lg:block lg:h-[calc(100dvh-90px)] lg:overflow-y-auto`} aria-label="Propriétés">
          <h2 className="mb-4 text-base font-bold">{propsTitle}</h2>
          {propsPanel}
        </aside>
      </div>
    </div>
  );
}

function slugifyLabel(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

type QrDest = { type: "card" | "section" | "url" | "site"; url?: string; section?: string; site?: string };
type QrVariantT = { slug: string; label: string; dest: QrDest; campaign?: { dest: QrDest; startsAt?: string; endsAt?: string } };

function DestEditor({ value, sections, sites, onChange }: { value: QrDest; sections: { id: string; label: string }[]; sites: { slug: string; title: string }[]; onChange: (d: QrDest) => void }) {
  return (
    <div className="space-y-2">
      <select value={value.type} onChange={(e) => onChange({ type: e.target.value as QrDest["type"] })} className="min-h-9 w-full rounded-lg border border-line px-2 text-sm">
        <option value="card">La carte numérique</option>
        {sections.length > 0 && <option value="section">Un bloc de la carte</option>}
        {sites.length > 0 && <option value="site">Un mini-site</option>}
        <option value="url">Une adresse externe</option>
      </select>
      {value.type === "url" && (
        <input value={value.url ?? ""} onChange={(e) => onChange({ type: "url", url: e.target.value })} placeholder="https://exemple.fr/devis" maxLength={2048} className="min-h-9 w-full rounded-lg border border-line px-2 text-sm" aria-label="Adresse externe" />
      )}
      {value.type === "section" && (
        <select value={value.section ?? ""} onChange={(e) => onChange({ type: "section", section: e.target.value })} className="min-h-9 w-full rounded-lg border border-line px-2 text-sm">
          <option value="">Choisir un bloc…</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      )}
      {value.type === "site" && (
        <select value={value.site ?? ""} onChange={(e) => onChange({ type: "site", site: e.target.value })} className="min-h-9 w-full rounded-lg border border-line px-2 text-sm">
          <option value="">Choisir un mini-site…</option>
          {sites.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
        </select>
      )}
    </div>
  );
}

function QrVariantsPanel({ cardId, shortUrl, initial, sections, sites, scans }: { cardId: string; shortUrl: string; initial: QrVariantT[]; sections: { id: string; label: string }[]; sites: { slug: string; title: string }[]; scans: Record<string, number> }) {
  const [variants, setVariants] = useState<QrVariantT[]>(initial);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: QrVariantT[]) =>
    start(async () => {
      const r = await setQrVariantsAction(cardId, next);
      if (r.ok) { setVariants(r.data as QrVariantT[]); setMsg({ ok: true, text: "QR enregistrés." }); }
      else setMsg({ ok: false, text: r.error });
    });

  const patch = (slug: string, fn: (v: QrVariantT) => QrVariantT) => setVariants((vs) => vs.map((v) => (v.slug === slug ? fn(v) : v)));
  const add = (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const slug = slugifyLabel(clean);
    if (!slug || variants.some((v) => v.slug === slug)) { setMsg({ ok: false, text: "Nom vide ou déjà utilisé." }); return; }
    if (variants.length >= 12) { setMsg({ ok: false, text: "12 QR maximum." }); return; }
    save([...variants, { slug, label: clean, dest: { type: "card" } }]);
    setDraft("");
  };

  const linkFor = (slug: string) => `${shortUrl}?c=${slug}`;

  return (
    <fieldset className="space-y-3 rounded-lg border border-line p-3">
      <legend className="px-1 font-semibold">QR intelligents (par support)</legend>
      <p className="text-xs text-muted">Un QR par support (carte, véhicule, vitrine, flyer…). Chacun a son propre QR à imprimer, sa destination modifiable à tout moment (sans réimprimer), une campagne temporaire possible, et son nombre de scans.</p>

      {variants.length === 0 && (
        <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => save([{ slug: "carte-de-visite", label: "Carte de visite", dest: { type: "card" } }, { slug: "vehicule", label: "Véhicule", dest: { type: "card" } }])}>
          Ajouter les exemples (Carte de visite, Véhicule)
        </button>
      )}

      <ul className="space-y-3">
        {variants.map((v) => {
          const hasCampaign = !!v.campaign;
          return (
            <li key={v.slug} className="rounded-lg border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{v.label} <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-normal text-muted">{scans[v.slug] ?? 0} scan(s)</span></span>
                <button type="button" disabled={pending} className="text-xs font-semibold text-danger hover:underline" onClick={() => save(variants.filter((x) => x.slug !== v.slug))}>Supprimer</button>
              </div>
              <div className="mt-2 flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/app/cartes/${cardId}/qr?format=svg&c=${v.slug}`} alt={`QR ${v.label}`} className="h-16 w-16 shrink-0 rounded bg-white p-1 ring-1 ring-line" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <a href={`/app/cartes/${cardId}/qr?format=png&download=1&c=${v.slug}`} className={buttonClass("primary", "sm")}>PNG</a>
                    <a href={`/app/cartes/${cardId}/qr?format=svg&download=1&c=${v.slug}`} className={buttonClass("secondary", "sm")}>SVG</a>
                    <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { await navigator.clipboard.writeText(linkFor(v.slug)); setCopied(v.slug); setTimeout(() => setCopied(null), 2000); }}>{copied === v.slug ? "Copié" : "Lien"}</button>
                  </div>
                  <code className="block truncate text-[11px] text-muted">{linkFor(v.slug)}</code>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-xs font-semibold">Destination</p>
                <DestEditor value={v.dest} sections={sections} sites={sites} onChange={(dest) => { patch(v.slug, (x) => ({ ...x, dest })); }} />
              </div>

              <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={hasCampaign} onChange={(e) => save(variants.map((x) => x.slug !== v.slug ? x : e.target.checked ? { ...x, campaign: { dest: { type: "url" }, startsAt: "", endsAt: "" } } : { ...x, campaign: undefined }))} />
                Campagne temporaire (redirige ailleurs pendant une période, puis revient)
              </label>
              {v.campaign && (
                <div className="mt-1 space-y-2 rounded-lg bg-surface p-2">
                  <p className="text-[11px] font-semibold text-muted">Pendant la campagne, rediriger vers :</p>
                  <DestEditor value={v.campaign.dest} sections={sections} sites={sites} onChange={(dest) => patch(v.slug, (x) => ({ ...x, campaign: { ...x.campaign!, dest } }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold">Début<input type="datetime-local" value={v.campaign.startsAt ?? ""} onChange={(e) => patch(v.slug, (x) => ({ ...x, campaign: { ...x.campaign!, startsAt: e.target.value } }))} onBlur={() => save(variants)} className="mt-0.5 block w-full rounded border border-line px-1 text-xs" /></label>
                    <label className="text-[11px] font-semibold">Fin<input type="datetime-local" value={v.campaign.endsAt ?? ""} onChange={(e) => patch(v.slug, (x) => ({ ...x, campaign: { ...x.campaign!, endsAt: e.target.value } }))} onBlur={() => save(variants)} className="mt-0.5 block w-full rounded border border-line px-1 text-xs" /></label>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => save(variants)}>Enregistrer ce QR</button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} maxLength={40} placeholder="Nouveau QR (ex. Flyer)" className="min-h-10 w-full rounded-lg border border-line px-2 text-sm" aria-label="Nom du QR" />
        <button type="button" disabled={pending || !draft.trim()} className={buttonClass("secondary", "sm")} onClick={() => add(draft)}>Ajouter</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </fieldset>
  );
}

function QrPanel({ cardId, shortUrl, publicUrl, published, initialStyle, initialVariants, sections, sites, scans }: { cardId: string; shortUrl: string; publicUrl: string; published: boolean; initialStyle: { dark: string; logo: "none" | "card" | "brand" }; initialVariants: QrVariantT[]; sections: { id: string; label: string }[]; sites: { slug: string; title: string }[]; scans: Record<string, number> }) {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState(initialStyle);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/app/cartes/${cardId}/qr?format=svg&v=${version}`} alt={`QR code menant à ${shortUrl}`} className="mx-auto w-48 rounded-lg bg-white p-2 ring-1 ring-line" />
      <fieldset className="space-y-3 rounded-lg border border-line p-3">
        <legend className="px-1 font-semibold">Personnaliser</legend>
        <label className="flex items-center justify-between gap-2">
          <span>Couleur des modules</span>
          <span className="flex items-center gap-2">
            <input type="color" value={style.dark} onChange={(e) => setStyle({ ...style, dark: e.target.value.toUpperCase() })} aria-label="Couleur du QR code" className="h-9 w-11 rounded border border-line p-0.5" />
            <code className="text-xs">{style.dark}</code>
          </span>
        </label>
        <label className="block">
          Logo au centre
          <select value={style.logo} onChange={(e) => setStyle({ ...style, logo: e.target.value as typeof style.logo })} className="mt-1 block min-h-10 w-full rounded-lg border border-line px-2">
            <option value="none">Aucun</option>
            <option value="card">Logo de la carte</option>
            <option value="brand">Logo de l&apos;entreprise</option>
          </select>
        </label>
        <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => start(async () => {
          const r = await setQrStyleAction(cardId, style);
          setMsg(r.ok ? { ok: true, text: r.data } : { ok: false, text: r.error });
          if (r.ok) setVersion((v) => v + 1);
        })}>{pending ? "Vérification…" : "Vérifier et enregistrer"}</button>
        <p className="text-xs text-muted">Avant l&apos;enregistrement, le QR est généré puis décodé automatiquement à deux tailles ; une couleur trop claire ou un logo gênant la lecture sont refusés.</p>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </fieldset>
      <div className="flex gap-2">
        <a href={`/app/cartes/${cardId}/qr?format=png&download=1`} className={buttonClass("primary", "sm")}>Télécharger PNG</a>
        <a href={`/app/cartes/${cardId}/qr?format=svg&download=1`} className={buttonClass("secondary", "sm")}>Télécharger SVG</a>
      </div>
      <p className="text-muted">Le QR code pointe vers un lien permanent ({shortUrl}). Il reste valable si vous changez l&apos;adresse de la carte, et affiche une page d&apos;indisponibilité si la carte est retirée ou si l&apos;abonnement prend fin.</p>
      {!published && <p className="font-semibold text-warning">La carte n&apos;est pas encore publiée : le QR mène pour l&apos;instant à une page d&apos;indisponibilité.</p>}
      <QrVariantsPanel cardId={cardId} shortUrl={shortUrl} initial={initialVariants} sections={sections} sites={sites} scans={scans} />
      <div>
        <p className="font-semibold">Adresse de la carte</p>
        <div className="mt-1 flex gap-2">
          <input readOnly value={publicUrl} className="min-h-10 w-full rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Adresse publique" />
          <button type="button" className={buttonClass("secondary", "sm")} onClick={async () => { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "Copiée" : "Copier"}</button>
        </div>
      </div>
      <p className="text-xs text-muted">Conseil d&apos;impression : au moins 2 × 2 cm, sur fond clair, sans déformer l&apos;image. Testez le scan avant impression.</p>
    </div>
  );
}

function VersionsPanel({ cardId, versions, flush }: { cardId: string; versions: { id: string; number: number; createdAt: string }[]; flush: () => Promise<boolean> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!versions.length) return <p className="text-sm text-muted">Aucune version publiée pour le moment.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Restaurer une version la recopie dans le brouillon. La carte publique ne change qu&apos;après une nouvelle publication.</p>
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-lg p-2 ring-1 ring-line">
            <span className="text-sm"><strong>Version {v.number}</strong><br /><span className="text-xs text-muted">{new Date(v.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span></span>
            <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => {
              if (!window.confirm(`Remplacer le brouillon actuel par la version ${v.number} ?`)) return;
              start(async () => {
                await flush();
                const r = await restoreVersionAction(cardId, v.id);
                if (r.ok) window.location.reload();
                else setError(r.error);
              });
            }}>Restaurer</button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

function SettingsPanel({ cardId, slug, publicBase, members, assignees }: { cardId: string; slug: string; publicBase: string; members: { userId: string; name: string; email: string }[]; assignees: string[] }) {
  const [value, setValue] = useState(slug);
  const [selected, setSelected] = useState<string[]>(assignees);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6 text-sm">
      <form onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await renameCardSlugAction(cardId, value);
        setMsg(r.ok ? { tone: "success", text: `Adresse modifiée : ${publicBase}/${r.data}. L'ancienne adresse redirige vers la nouvelle.` } : { tone: "danger", text: r.error });
        if (r.ok) setValue(r.data);
      }); }} className="space-y-2">
        <label htmlFor="slug" className="font-semibold">Adresse de la carte</label>
        <p className="text-xs text-muted">{publicBase}/</p>
        <input id="slug" value={value} onChange={(e) => setValue(e.target.value)} maxLength={48} className="min-h-11 w-full rounded-lg border border-line px-3" />
        <button type="submit" disabled={pending || value === slug} className={buttonClass("secondary", "sm")}>Modifier l&apos;adresse</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await setCardAssigneesAction(cardId, selected);
        setMsg(r.ok ? { tone: "success", text: "Attribution enregistrée." } : { tone: "danger", text: r.error });
      }); }} className="space-y-2">
        <fieldset>
          <legend className="font-semibold">Collaborateurs autorisés à modifier cette carte</legend>
          <p className="text-xs text-muted">Les propriétaires et gestionnaires ont toujours accès.</p>
          <div className="mt-2 space-y-1">
            {members.length === 0 && <p className="text-xs text-muted">Aucun collaborateur dans l&apos;organisation.</p>}
            {members.map((m) => (
              <label key={m.userId} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={selected.includes(m.userId)} onChange={(e) => setSelected(e.target.checked ? [...selected, m.userId] : selected.filter((x) => x !== m.userId))} />
                <span>{m.name} <span className="text-muted">({m.email})</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>Enregistrer l&apos;attribution</button>
      </form>
      {msg && <p role={msg.tone === "danger" ? "alert" : "status"} className={`font-semibold ${msg.tone === "danger" ? "text-danger" : "text-success"}`}>{msg.text}</p>}
    </div>
  );
}

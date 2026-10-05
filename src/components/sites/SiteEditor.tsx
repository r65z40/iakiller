"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { CardView, type MediaInfo } from "@/components/card/CardView";
import { BlockList } from "@/components/editor/BlockList";
import { ThemePanel, IdentityPanel, BannerPanel, BlockPanel, type LockState } from "@/components/editor/panels";
import type { LibraryItem } from "@/components/editor/MediaPicker";
import { BLOCK_LIBRARY, newBlock } from "@/lib/cards/defaults";
import { blockId } from "@/lib/cards/client-ids";
import type { BlockType, CardBlock, CardDocument } from "@/lib/cards/document";
import { pageDocument, type SiteDocument, type SitePage } from "@/lib/sites/document";
import { useSiteAutosave } from "./useSiteAutosave";
import { publishSiteAction, unpublishSiteAction } from "@/app/app/_actions/sites";

type Selection = string | "identity" | "banner" | "theme" | "page" | null;

function slugifyPage(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "page";
}

const STATUS_LABEL: Record<string, string> = { saved: "Enregistré", dirty: "Modifié…", saving: "Enregistrement…", error: "Reconnexion…", conflict: "Conflit", invalid: "Non enregistré" };

export function SiteEditor(props: {
  site: { id: string; title: string; slug: string; status: string; revision: number; publishedAt: string | null; publicUrl: string; hasUnpublishedChanges: boolean };
  initialDoc: SiteDocument;
  library: LibraryItem[];
  locks: LockState;
  canPublish: boolean;
  publishBlockedReason: string | null;
}) {
  const [doc, setDoc] = useState<SiteDocument>(props.initialDoc);
  const [title, setTitle] = useState(props.site.title);
  const [library, setLibrary] = useState(props.library);
  const [activePageId, setActivePageId] = useState(props.initialDoc.pages[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection>(null);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [publishing, startPublish] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const autosave = useSiteAutosave(props.site.id, props.site.revision);

  const activePage = useMemo(() => doc.pages.find((p) => p.id === activePageId) ?? doc.pages[0], [doc.pages, activePageId]);

  const media = useMemo<Record<string, MediaInfo>>(
    () => Object.fromEntries(library.map((m) => [m.id, { url: m.url, name: m.name, sizeBytes: m.sizeBytes, width: m.width, height: m.height }])),
    [library],
  );

  const apply = useCallback(
    (next: SiteDocument, nextTitle = title) => {
      setDoc(next);
      autosave.schedule(next, nextTitle);
    },
    [autosave, title],
  );

  function patchPage(pageId: string, patch: Partial<SitePage>) {
    apply({ ...doc, pages: doc.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) });
  }
  function setPageBlocks(blocks: CardBlock[]) {
    patchPage(activePage.id, { blocks });
  }

  function addBlock(type: BlockType) {
    if ((type === "leadForm" || type === "map") && activePage.blocks.some((b) => b.type === type)) {
      setNotice(type === "leadForm" ? "Un seul formulaire par page." : "Un seul bloc « Zone d'intervention » par page.");
      return;
    }
    const b = newBlock(type);
    setPageBlocks([...activePage.blocks, b]);
    setSelection(b.id);
  }
  function updateBlock(next: CardBlock) {
    setPageBlocks(activePage.blocks.map((b) => (b.id === next.id ? next : b)));
  }

  function addPage() {
    if (doc.pages.length >= 8) { setNotice("Maximum 8 pages."); return; }
    const existing = new Set(doc.pages.map((p) => p.slug));
    let slug = "page";
    for (let i = 2; existing.has(slug); i++) slug = `page-${i}`;
    const p: SitePage = { id: blockId(), key: "page", label: "Nouvelle page", slug, blocks: [newBlock("about")] };
    apply({ ...doc, pages: [...doc.pages, p] });
    setActivePageId(p.id);
    setSelection("page");
  }
  function deletePage(id: string) {
    if (doc.pages.length <= 1) { setNotice("Un mini-site doit garder au moins une page."); return; }
    const pages = doc.pages.filter((p) => p.id !== id);
    apply({ ...doc, pages });
    setActivePageId(pages[0].id);
    setSelection(null);
  }
  function movePage(id: string, dir: -1 | 1) {
    const i = doc.pages.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= doc.pages.length) return;
    const pages = [...doc.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    apply({ ...doc, pages });
  }
  function renamePage(id: string, label: string, rawSlug: string) {
    const slug = slugifyPage(rawSlug || label);
    const taken = doc.pages.some((p) => p.id !== id && p.slug === slug);
    patchPage(id, { label: label.slice(0, 40) || "Page", slug: taken ? `${slug}-${id.slice(0, 4)}` : slug });
  }

  const previewDoc: CardDocument = useMemo(() => pageDocument(doc, activePage), [doc, activePage]);

  function onPublish() {
    startPublish(async () => {
      await autosave.flush();
      const r = await publishSiteAction(props.site.id);
      setNotice(r.ok ? "Mini-site publié." : r.error);
    });
  }
  function onUnpublish() {
    startPublish(async () => {
      const r = await unpublishSiteAction(props.site.id);
      setNotice(r.ok ? "Mini-site dépublié." : r.error);
    });
  }

  const selectedBlock = typeof selection === "string" && !["identity", "banner", "theme", "page"].includes(selection) ? activePage.blocks.find((b) => b.id === selection) : null;
  const inputCls = "min-h-10 w-full rounded-lg border border-line px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Barre supérieure */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
        <div className="flex items-center gap-3">
          <Link href="/app/mini-sites" className="text-sm font-semibold text-brand underline">← Mes mini-sites</Link>
          <input aria-label="Titre du mini-site" value={title} onChange={(e) => { setTitle(e.target.value); apply(doc, e.target.value); }} className="min-h-9 rounded-lg border border-line px-2 text-sm font-semibold" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted" role="status">{STATUS_LABEL[autosave.status]}</span>
          {autosave.status === "conflict" && <button type="button" onClick={() => void autosave.overwrite()} className={buttonClass("secondary", "sm")}>Garder ma version</button>}
          {props.site.status === "published" && <Link href={props.site.publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand underline">Voir en ligne</Link>}
          {props.site.status === "published"
            ? <button type="button" disabled={publishing} onClick={onUnpublish} className={buttonClass("ghost", "sm")}>Dépublier</button>
            : null}
          <button type="button" disabled={publishing || !props.canPublish} title={props.publishBlockedReason ?? undefined} onClick={onPublish} className={buttonClass("primary", "sm")}>
            {props.site.status === "published" ? "Republier" : "Publier"}
          </button>
        </div>
      </div>
      {notice && <p role="status" className="rounded-lg bg-[var(--c-soft,#eef2ff)] px-3 py-2 text-sm text-ink">{notice}</p>}
      {props.publishBlockedReason && <p className="text-xs text-muted">{props.publishBlockedReason}</p>}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* Colonne gauche : pages + blocs */}
        <div className="space-y-4">
          <section className="rounded-xl bg-white p-3 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">Pages</h2>
              <button type="button" onClick={addPage} className={buttonClass("secondary", "sm")}>+ Page</button>
            </div>
            <ul className="space-y-1">
              {doc.pages.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setActivePageId(p.id); setSelection(null); }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${p.id === activePage.id ? "bg-brand text-white" : "hover:bg-surface"}`}>
                    <span className="truncate">{p.label}</span>
                    <span className={`text-xs ${p.id === activePage.id ? "text-white/70" : "text-muted"}`}>{p.blocks.length}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setSelection("page")} className="mt-2 text-xs text-brand underline">Réglages de la page active</button>
          </section>

          <section className="rounded-xl bg-white p-3 ring-1 ring-line">
            <h2 className="mb-2 text-sm font-bold">Blocs de « {activePage.label} »</h2>
            <BlockList
              blocks={activePage.blocks}
              selectedId={typeof selection === "string" ? selection : null}
              onSelect={(id) => setSelection(id)}
              onReorder={(blocks) => setPageBlocks(blocks)}
              onToggle={(id) => setPageBlocks(activePage.blocks.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)))}
              onDuplicate={(id) => {
                const src = activePage.blocks.find((b) => b.id === id);
                if (!src || src.type === "leadForm") return;
                const copy = { ...structuredClone(src), id: blockId() };
                const i = activePage.blocks.findIndex((b) => b.id === id);
                const blocks = [...activePage.blocks];
                blocks.splice(i + 1, 0, copy);
                setPageBlocks(blocks);
              }}
              onDelete={(id) => { setPageBlocks(activePage.blocks.filter((b) => b.id !== id)); if (selection === id) setSelection(null); }}
            />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {BLOCK_LIBRARY.map((b) => (
                <button key={b.type} type="button" onClick={() => addBlock(b.type)} title={b.description} className="rounded-lg border border-line px-2 py-1.5 text-left text-xs hover:bg-surface">
                  + {b.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-white p-3 ring-1 ring-line">
            <h2 className="mb-2 text-sm font-bold">Apparence du site</h2>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setSelection("identity")} className={buttonClass("secondary", "sm")}>Identité</button>
              <button type="button" onClick={() => setSelection("banner")} className={buttonClass("secondary", "sm")}>Bannière</button>
              <button type="button" onClick={() => setSelection("theme")} className={buttonClass("secondary", "sm")}>Thème</button>
            </div>
          </section>
        </div>

        {/* Centre : aperçu */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <nav className="flex flex-wrap gap-1" aria-label="Pages du mini-site (aperçu)">
              {doc.pages.map((p) => (
                <button key={p.id} type="button" onClick={() => { setActivePageId(p.id); setSelection(null); }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${p.id === activePage.id ? "bg-ink text-white ring-ink" : "bg-white ring-line"}`}>{p.label}</button>
              ))}
            </nav>
            <div className="flex gap-1">
              <button type="button" onClick={() => setDevice("phone")} className={`rounded-lg px-2 py-1 text-xs ring-1 ${device === "phone" ? "bg-brand text-white ring-brand" : "ring-line"}`}>Mobile</button>
              <button type="button" onClick={() => setDevice("desktop")} className={`rounded-lg px-2 py-1 text-xs ring-1 ${device === "desktop" ? "bg-brand text-white ring-brand" : "ring-line"}`}>Ordinateur</button>
            </div>
          </div>
          <div className="flex justify-center rounded-xl bg-surface/60 p-4 ring-1 ring-line">
            <div className={device === "phone" ? "w-[390px] max-w-full overflow-hidden rounded-[28px] ring-8 ring-ink/80" : "w-full overflow-hidden rounded-xl ring-1 ring-line"}>
              <CardView doc={previewDoc} media={media} mode="preview" highlightBlockId={typeof selection === "string" ? selection : null} onSelectBlock={(id) => setSelection(id)} />
            </div>
          </div>
        </div>

        {/* Droite : inspecteur */}
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-line">
            {selection === "theme" && <ThemePanel theme={doc.theme} onChange={(theme) => apply({ ...doc, theme })} locks={props.locks} />}
            {selection === "identity" && <IdentityPanel identity={doc.identity} onChange={(identity) => apply({ ...doc, identity })} locks={props.locks} library={library} onUploaded={(m) => setLibrary((l) => [m, ...l])} />}
            {selection === "banner" && <BannerPanel banner={doc.banner} onChange={(banner) => apply({ ...doc, banner })} library={library} onUploaded={(m) => setLibrary((l) => [m, ...l])} />}
            {selection === "page" && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold">Réglages de la page</h2>
                <label className="block text-[13px] font-semibold">Nom<input value={activePage.label} onChange={(e) => renamePage(activePage.id, e.target.value, activePage.slug)} maxLength={40} className={`mt-1 ${inputCls}`} /></label>
                <label className="block text-[13px] font-semibold">Adresse (URL)<input value={activePage.slug} onChange={(e) => renamePage(activePage.id, activePage.label, e.target.value)} maxLength={40} className={`mt-1 ${inputCls}`} /><span className="mt-1 block text-xs font-normal text-muted">{props.site.publicUrl}/{activePage.slug}</span></label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => movePage(activePage.id, -1)} className={buttonClass("secondary", "sm")}>↑ Monter</button>
                  <button type="button" onClick={() => movePage(activePage.id, 1)} className={buttonClass("secondary", "sm")}>↓ Descendre</button>
                  <button type="button" onClick={() => deletePage(activePage.id)} className={buttonClass("ghost", "sm")}>Supprimer</button>
                </div>
              </div>
            )}
            {selectedBlock && <BlockPanel block={selectedBlock} onChange={updateBlock} library={library} onUploaded={(m) => setLibrary((l) => [m, ...l])} />}
            {selection === null && <p className="text-sm text-muted">Sélectionnez un bloc, une page, ou un réglage d&apos;apparence pour le modifier.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

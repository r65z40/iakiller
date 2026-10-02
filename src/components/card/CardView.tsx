"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Calendar, Clock, Download, FileText, Globe, Link as LinkIcon, Mail, MapPin, MessageCircle, MessageSquare,
  Phone, Play, Smartphone, Star, Store, UserPlus,
} from "lucide-react";
import type { CardBlock, CardDocument, ContactKind } from "@/lib/cards/document";
import { FONTS } from "@/lib/cards/document";
import { normalizePhone, normalizeWebUrl, toInternationalDigits, videoEmbedUrl } from "@/lib/validation/urls";
import { RichText } from "./RichText";

export interface MediaInfo {
  url: string;
  name?: string;
  sizeBytes?: number;
  width?: number | null;
  height?: number | null;
}

export interface CardViewProps {
  doc: CardDocument;
  media: Record<string, MediaInfo>;
  mode: "public" | "preview";
  /** Jeton public de la carte (statistiques et formulaire). */
  publicToken?: string;
  vcardUrl?: string;
  analytics?: { enabled: boolean; requireConsent: boolean; source: string; utm?: Record<string, string> };
  leadFormToken?: string;
  footer?: { brandName: string; privacyUrl: string; legalUrl: string };
  /** Bloc mis en évidence dans l'éditeur. */
  highlightBlockId?: string | null;
  onSelectBlock?: (id: string | "identity" | "banner") => void;
}

type Track = (type: string, target?: string) => void;

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

function randomViewId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CONSENT_KEY = "carte-mesure-audience";

function readConsent(): "granted" | "denied" | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(v: "granted" | "denied") {
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* stockage indisponible : le choix vaut pour la page courante */
  }
}

export function CardView(props: CardViewProps) {
  const { doc, media, mode } = props;
  const theme = doc.theme;
  const viewId = useRef<string>("");
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const sentView = useRef(false);

  const analyticsActive =
    mode === "public" && !!props.analytics?.enabled && !!props.publicToken && (!props.analytics.requireConsent || consent === "granted");

  const send = useCallback(
    (type: string, target?: string) => {
      if (!analyticsActive || !props.publicToken) return;
      if (!viewId.current) viewId.current = randomViewId();
      const payload = JSON.stringify({
        token: props.publicToken,
        viewId: viewId.current,
        type,
        target: target ?? null,
        source: props.analytics?.source ?? "direct",
        utm: props.analytics?.utm ?? {},
      });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (!navigator.sendBeacon?.("/api/public/events", blob)) {
          void fetch("/api/public/events", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true });
        }
      } catch {
        /* la mesure ne doit jamais gêner la visite */
      }
    },
    [analyticsActive, props.publicToken, props.analytics?.source, props.analytics?.utm],
  );

  useEffect(() => {
    if (mode !== "public") return;
    setConsent(readConsent());
    setConsentLoaded(true);
    // Retire les paramètres de suivi de l'adresse affichée (partage plus propre).
    try {
      const url = new URL(window.location.href);
      let changed = false;
      for (const k of ["src", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        if (url.searchParams.has(k)) {
          url.searchParams.delete(k);
          changed = true;
        }
      }
      if (changed) window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (analyticsActive && !sentView.current) {
      sentView.current = true;
      send("view");
    }
  }, [analyticsActive, send]);

  const track: Track = mode === "public" ? send : () => {};

  const style = useMemo(
    () =>
      ({
        "--c-primary": theme.primaryColor,
        "--c-page": theme.pageBackground,
        "--c-card": theme.cardBackground,
        "--c-text": theme.textColor,
        "--c-muted": theme.mutedColor,
        "--c-on-primary": theme.buttonTextColor,
        "--c-soft": `color-mix(in srgb, ${theme.primaryColor} 10%, ${theme.cardBackground})`,
        "--c-soft-border": `color-mix(in srgb, ${theme.primaryColor} 18%, ${theme.cardBackground})`,
        "--c-line": `color-mix(in srgb, ${theme.textColor} 9%, ${theme.cardBackground})`,
        "--radius": `${theme.radius}px`,
        "--border-w": `${theme.borderWidth}px`,
        "--gap": theme.spacing === "compact" ? "14px" : theme.spacing === "airy" ? "26px" : "20px",
        fontFamily: FONTS[theme.font]?.css,
        color: "var(--c-text)",
      }) as CSSProperties,
    [theme],
  );

  const contacts = doc.blocks.filter((b): b is Extract<CardBlock, { type: "contacts" }> => b.type === "contacts" && !b.hidden).flatMap((b) => b.items);
  const firstPhone = contacts.find((c) => c.kind === "mobile" && c.value) ?? contacts.find((c) => c.kind === "landline" && c.value);
  const firstEmail = contacts.find((c) => c.kind === "email" && c.value);

  const align = theme.align === "center" ? "text-center items-center" : "text-left items-start";
  const selectable = (id: string | "identity" | "banner") =>
    props.onSelectBlock
      ? {
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            props.onSelectBlock?.(id);
          },
          "data-selected": props.highlightBlockId === id ? "true" : undefined,
          className: "cursor-pointer outline-offset-[-2px] data-[selected=true]:outline-2 data-[selected=true]:outline-dashed data-[selected=true]:outline-[var(--c-primary)]",
        }
      : {};

  return (
    <div style={style} className="card-root w-full">
      <article
        className="mx-auto w-full max-w-[400px] overflow-hidden bg-[var(--c-card)] shadow-[0_8px_30px_rgba(20,33,61,0.08)]"
        style={{ borderRadius: `calc(var(--radius) + 4px)` }}
        aria-label={`Carte de visite de ${[doc.identity.firstName, doc.identity.lastName].filter(Boolean).join(" ") || doc.identity.company}`}
      >
        <Header doc={doc} media={media} align={align} selectable={selectable} />

        {doc.blocks
          .filter((b) => !b.hidden)
          .map((block) => {
            const sel = selectable(block.id);
            return (
              <div key={block.id} {...sel} className={`${sel.className ?? ""}`}>
                <Block
                  block={block}
                  doc={doc}
                  media={media}
                  track={track}
                  mode={mode}
                  phone={firstPhone?.value}
                  phoneKind={firstPhone?.kind}
                  email={firstEmail?.value}
                  vcardUrl={props.vcardUrl}
                  publicToken={props.publicToken}
                  leadFormToken={props.leadFormToken}
                />
              </div>
            );
          })}

        {props.footer && (
          <footer className="border-t border-[var(--c-line)] px-5 py-4 text-center text-[11px] text-[var(--c-muted)]">
            <a href={props.footer.privacyUrl} className="underline-offset-2 hover:underline">Données personnelles</a>
            <span aria-hidden> · </span>
            <a href={props.footer.legalUrl} className="underline-offset-2 hover:underline">Mentions légales</a>
            <span aria-hidden> · </span>
            <span>Carte réalisée avec {props.footer.brandName}</span>
          </footer>
        )}
      </article>

      {mode === "public" && props.analytics?.enabled && props.analytics.requireConsent && consentLoaded && consent === null && (
        <div role="region" aria-label="Mesure d'audience" className="fixed inset-x-0 bottom-0 z-20 p-3">
          <div className="mx-auto flex max-w-[400px] flex-col gap-2 rounded-xl bg-white p-3 text-[13px] text-[#14213d] shadow-lg ring-1 ring-black/10">
            <p>Acceptez-vous une mesure d&apos;audience anonyme de cette carte (pages vues et clics, sans profil ni publicité) ?</p>
            <div className="flex gap-2">
              <button type="button" className="flex-1 rounded-lg border border-[#c9d1df] px-3 py-2 font-semibold" onClick={() => { writeConsent("denied"); setConsent("denied"); }}>Refuser</button>
              <button type="button" className="flex-1 rounded-lg bg-[#14213d] px-3 py-2 font-semibold text-white" onClick={() => { writeConsent("granted"); setConsent("granted"); }}>Accepter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Avatar({ src, alt, size, rounded, className = "" }: { src?: string; alt: string; size: number; rounded: "full" | "box"; className?: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`border-[3px] border-[var(--c-card)] object-cover shadow-[0_4px_14px_rgba(20,33,61,0.18)] ${rounded === "full" ? "rounded-full" : ""} ${className}`}
      style={{ width: size, height: size, borderRadius: rounded === "box" ? Math.min(18, Number(size) / 4) : undefined, background: "var(--c-card)" }}
    />
  );
}

function Header({
  doc,
  media,
  align,
  selectable,
}: {
  doc: CardDocument;
  media: Record<string, MediaInfo>;
  align: string;
  selectable: (id: string | "identity" | "banner") => Record<string, unknown>;
}) {
  const { identity, banner, theme } = doc;
  const bannerUrl = banner.mediaId ? media[banner.mediaId]?.url : undefined;
  const logoUrl = identity.showLogo && identity.logoMediaId ? media[identity.logoMediaId]?.url : undefined;
  const photoUrl = identity.showPhoto && identity.photoMediaId ? media[identity.photoMediaId]?.url : undefined;
  const fullName = [identity.firstName, identity.lastName].filter(Boolean).join(" ");
  const nameSize = theme.nameSize === "lg" ? "text-[30px]" : theme.nameSize === "sm" ? "text-[22px]" : "text-[26px]";
  const template = theme.template;

  const bannerEl = (
    <div {...selectable("banner")} className={`relative w-full overflow-hidden ${(selectable("banner") as { className?: string }).className ?? ""}`} style={{ height: template === "entreprise" ? Math.min(banner.height, 120) : banner.height }}>
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${banner.focalX}% ${banner.focalY}%`, filter: banner.blur ? `blur(${banner.blur}px)` : undefined, transform: banner.blur ? "scale(1.08)" : undefined }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 55%, #ffffff))` }} />
      )}
      {bannerUrl && banner.veilOpacity > 0 && <div className="absolute inset-0 bg-white" style={{ opacity: banner.veilOpacity / 100 }} />}
    </div>
  );

  const identitySel = selectable("identity") as { className?: string };
  const textBlock = (
    <>
      <h1 className={`${nameSize} font-extrabold leading-[1.12] tracking-[-0.01em]`}>
        {template === "entreprise" || !identity.lastName ? (
          fullName || identity.company
        ) : (
          <>
            {identity.firstName && <span className="block">{identity.firstName}</span>}
            <span className="block uppercase">{identity.lastName}</span>
          </>
        )}
      </h1>
      {identity.jobTitle && <p className="mt-1.5 text-[14px] text-[var(--c-muted)]">{identity.jobTitle}</p>}
      {identity.company && (fullName || template !== "entreprise") && <p className="mt-0.5 text-[14px] font-bold text-[var(--c-primary)]">{identity.company}</p>}
    </>
  );

  if (template === "portrait") {
    return (
      <header>
        {bannerEl}
        <div {...selectable("identity")} className={`relative flex flex-col px-5 pb-5 ${align} ${identitySel.className ?? ""}`}>
          <div className={`relative ${photoUrl ? "-mt-16" : logoUrl ? "-mt-12" : "mt-5"}`}>
            {photoUrl ? <Avatar src={photoUrl} alt={fullName ? `Photo de ${fullName}` : "Photo de profil"} size={124} rounded="full" /> : logoUrl ? <Avatar src={logoUrl} alt="Logo" size={96} rounded="box" /> : null}
            {photoUrl && logoUrl && <Avatar src={logoUrl} alt={identity.company ? `Logo ${identity.company}` : "Logo"} size={40} rounded="box" className="absolute -bottom-1 -right-1" />}
          </div>
          <div className="mt-3">{textBlock}</div>
        </div>
      </header>
    );
  }

  if (template === "entreprise") {
    return (
      <header>
        {bannerEl}
        <div {...selectable("identity")} className={`relative px-5 pb-5 ${identitySel.className ?? ""}`}>
          <div className={`flex items-end justify-between ${logoUrl || photoUrl ? "-mt-9" : "pt-3"}`}>
            {logoUrl ? <Avatar src={logoUrl} alt={identity.company ? `Logo ${identity.company}` : "Logo"} size={72} rounded="box" /> : <div />}
            {photoUrl && <Avatar src={photoUrl} alt={fullName ? `Photo de ${fullName}` : "Photo de profil"} size={64} rounded="full" />}
          </div>
          {identity.company && <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--c-primary)]">{identity.company}</p>}
          <div className="mt-1 text-left">{textBlock}</div>
        </div>
      </header>
    );
  }

  // Classique
  const mainAvatar = logoUrl ?? photoUrl;
  return (
    <header>
      {bannerEl}
      <div {...selectable("identity")} className={`relative flex flex-col px-5 pb-5 ${align} ${identitySel.className ?? ""}`}>
        {mainAvatar ? (
          <div className="-mt-10">
            <Avatar src={mainAvatar} alt={logoUrl ? (identity.company ? `Logo ${identity.company}` : "Logo") : fullName ? `Photo de ${fullName}` : "Photo"} size={80} rounded={logoUrl ? "box" : "full"} />
          </div>
        ) : (
          <div className="h-2" />
        )}
        <div className="mt-3">{textBlock}</div>
        {logoUrl && photoUrl && (
          <div className="mt-3">
            <Avatar src={photoUrl} alt={fullName ? `Photo de ${fullName}` : "Photo"} size={56} rounded="full" />
          </div>
        )}
      </div>
    </header>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <h2 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--c-primary)]">{children}</h2>;
}

function Section({ children, first }: { children: ReactNode; first?: boolean }) {
  return <section className={`${first ? "" : "border-t border-[var(--c-line)]"} px-5`} style={{ paddingTop: "var(--gap)", paddingBottom: "var(--gap)" }}>{children}</section>;
}

function buttonClasses(style: CardDocument["theme"]["buttonStyle"], primary: boolean) {
  if (primary || style === "filled") return "bg-[var(--c-primary)] text-[var(--c-on-primary)] border-transparent";
  if (style === "outline") return "bg-transparent text-[var(--c-primary)] border-[var(--c-primary)]";
  return "bg-[var(--c-soft)] text-[var(--c-text)] border-transparent";
}

const CONTACT_META: Record<ContactKind, { icon: ReactNode; defaultLabel: string; event: string }> = {
  mobile: { icon: <Smartphone size={15} aria-hidden />, defaultLabel: "Mobile", event: "click_call_mobile" },
  landline: { icon: <Phone size={15} aria-hidden />, defaultLabel: "Téléphone", event: "click_call_landline" },
  email: { icon: <Mail size={15} aria-hidden />, defaultLabel: "Email", event: "click_email" },
  whatsapp: { icon: <MessageCircle size={15} aria-hidden />, defaultLabel: "WhatsApp", event: "click_whatsapp" },
  sms: { icon: <MessageSquare size={15} aria-hidden />, defaultLabel: "SMS", event: "click_sms" },
  address: { icon: <MapPin size={15} aria-hidden />, defaultLabel: "Adresse", event: "click_address" },
  website: { icon: <Globe size={15} aria-hidden />, defaultLabel: "Site web", event: "click_website" },
};

function contactHref(kind: ContactKind, value: string): string | null {
  switch (kind) {
    case "mobile":
    case "landline": {
      const n = normalizePhone(value);
      return n ? `tel:${n}` : null;
    }
    case "sms": {
      const n = normalizePhone(value);
      return n ? `sms:${n}` : null;
    }
    case "whatsapp": {
      const n = toInternationalDigits(value);
      return n ? `https://wa.me/${n}` : null;
    }
    case "email":
      return `mailto:${value.trim()}`;
    case "website":
      return normalizeWebUrl(value);
    case "address":
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(value.replace(/\n/g, ", "))}`;
  }
}

function prettyUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "www.") + (u.pathname !== "/" ? u.pathname : "")).replace(/\/$/, "");
  } catch {
    return url;
  }
}

const SOCIAL_BADGE: Record<string, string> = { linkedin: "in", instagram: "ig", facebook: "f", x: "X", youtube: "▶", tiktok: "tt", other: "↗" };
const SOCIAL_LABEL: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", x: "X", youtube: "YouTube", tiktok: "TikTok", other: "Lien" };

function LinkIconBadge({ icon }: { icon: string }) {
  const map: Record<string, ReactNode> = {
    web: <span className="text-[11px] font-extrabold">www</span>,
    linkedin: <span className="text-[13px] font-extrabold">in</span>,
    instagram: <span className="text-[12px] font-extrabold">ig</span>,
    facebook: <span className="text-[13px] font-extrabold">f</span>,
    calendar: <Calendar size={16} aria-hidden />,
    document: <FileText size={16} aria-hidden />,
    shop: <Store size={16} aria-hidden />,
    star: <Star size={16} aria-hidden />,
    link: <LinkIcon size={16} aria-hidden />,
  };
  return (
    <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--c-card)] px-1.5 text-[var(--c-text)] shadow-[0_1px_2px_rgba(20,33,61,0.08)]">
      {map[icon] ?? map.link}
    </span>
  );
}

function linkProps(mode: "public" | "preview", external: boolean) {
  if (mode === "preview") return { onClick: (e: React.MouseEvent) => e.preventDefault() };
  return external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {};
}

function Block(props: {
  block: CardBlock;
  doc: CardDocument;
  media: Record<string, MediaInfo>;
  track: Track;
  mode: "public" | "preview";
  phone?: string;
  phoneKind?: ContactKind;
  email?: string;
  vcardUrl?: string;
  publicToken?: string;
  leadFormToken?: string;
}) {
  const { block, doc, track, mode, media } = props;
  const theme = doc.theme;

  switch (block.type) {
    case "actions": {
      const callHref = props.phone ? contactHref(props.phoneKind ?? "mobile", props.phone) : null;
      const mailHref = props.email ? `mailto:${props.email}` : null;
      const callLabel = block.callLabel || "Appeler";
      const personalized = doc.identity.firstName && callLabel === "Appeler" ? `Appeler ${doc.identity.firstName}` : callLabel;
      const showCall = block.showCall && callHref;
      const showMail = block.showEmail && mailHref;
      return (
        <div className="px-5 pb-5">
          {(showCall || showMail) && (
            <div className={`grid gap-2.5 ${showCall && showMail ? "grid-cols-2" : "grid-cols-1"}`}>
              {showCall && (
                <a href={callHref!} {...linkProps(mode, false)} onClickCapture={() => track(props.phoneKind === "landline" ? "click_call_landline" : "click_call_mobile", "actions")}
                  className={`flex min-h-12 items-center justify-center rounded-[var(--radius)] border-[length:var(--border-w)] px-3 text-center text-[14px] font-bold ${buttonClasses(theme.buttonStyle, false)}`}>
                  {personalized}
                </a>
              )}
              {showMail && (
                <a href={mailHref!} {...linkProps(mode, false)} onClickCapture={() => track("click_email", "actions")}
                  className={`flex min-h-12 items-center justify-center rounded-[var(--radius)] border-[length:var(--border-w)] px-3 text-center text-[14px] font-bold ${buttonClasses(theme.buttonStyle, false)}`}>
                  {block.emailLabel || "Envoyer un mail"}
                </a>
              )}
            </div>
          )}
          {block.showVcard && (
            <a href={props.vcardUrl ?? "#"} {...(mode === "preview" ? linkProps(mode, false) : {})} onClickCapture={() => track("download_vcard")}
              className={`mt-2.5 flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius)] px-3 text-[14px] font-bold ${buttonClasses(theme.buttonStyle, true)}`}>
              <UserPlus size={16} aria-hidden />
              {block.vcardLabel || "Ajouter aux contacts"}
            </a>
          )}
        </div>
      );
    }

    case "contacts": {
      const items = block.items.filter((i) => i.value.trim());
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Ajoutez vos coordonnées dans le panneau de droite.</p>}
          <ul className="space-y-3.5">
            {items.map((item) => {
              const meta = CONTACT_META[item.kind];
              const href = contactHref(item.kind, item.value);
              const external = item.kind === "website" || item.kind === "whatsapp" || item.kind === "address";
              const display = item.kind === "website" && href ? prettyUrl(href) : item.value;
              return (
                <li key={item.id}>
                  <a href={href ?? undefined} {...linkProps(mode, external)} onClickCapture={() => track(meta.event, item.kind)} className="group flex items-start gap-3 rounded-lg py-0.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--c-soft)] text-[var(--c-primary)]">{meta.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[12px] text-[var(--c-muted)]">
                        {item.label || meta.defaultLabel}
                        {item.kind === "address" && <span> · Voir l&apos;itinéraire</span>}
                      </span>
                      <span className="block whitespace-pre-line break-words text-[14px] font-medium group-hover:underline">{display}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Section>
      );
    }

    case "about":
      if (!block.text.trim() && !block.tags.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {block.text.trim() ? (
            <RichText text={block.text} className="space-y-2 text-[14px] leading-[1.6] text-[color-mix(in_srgb,var(--c-text)_82%,var(--c-card))]" />
          ) : (
            mode === "preview" && <p className="text-[13px] text-[var(--c-muted)]">Présentez votre activité en quelques lignes.</p>
          )}
          {block.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {block.tags.filter(Boolean).map((t, i) => (
                <li key={i} className="rounded-lg border border-[var(--c-line)] px-2.5 py-1 text-[12px]">{t}</li>
              ))}
            </ul>
          )}
        </Section>
      );

    case "links": {
      const items = block.items.filter((i) => i.title && i.url);
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Ajoutez des liens (site, catalogue, avis…).</p>}
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <a href={item.url} {...linkProps(mode, true)} onClickCapture={() => track("click_link", item.id)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--c-soft-border)] bg-[var(--c-soft)] px-4 py-3 transition hover:brightness-[0.98]">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-[var(--c-primary)]">{item.title}</span>
                    {(item.subtitle || item.url) && <span className="block truncate text-[12px] text-[var(--c-muted)]">{item.subtitle || prettyUrl(item.url)}</span>}
                  </span>
                  <LinkIconBadge icon={item.icon} />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "social": {
      const items = block.items.filter((i) => i.url);
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <a href={item.url} {...linkProps(mode, true)} onClickCapture={() => track("click_social", item.network)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--c-soft-border)] bg-[var(--c-soft)] px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-[var(--c-primary)]">{item.label || SOCIAL_LABEL[item.network]}</span>
                    <span className="block truncate text-[12px] text-[var(--c-muted)]">{SOCIAL_LABEL[item.network]}</span>
                  </span>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[var(--c-card)] px-1.5 text-[13px] font-extrabold shadow-[0_1px_2px_rgba(20,33,61,0.08)]">{SOCIAL_BADGE[item.network]}</span>
                </a>
              </li>
            ))}
          </ul>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Ajoutez vos profils.</p>}
        </Section>
      );
    }

    case "gallery": {
      const items = block.items.filter((i) => media[i.mediaId]);
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Ajoutez des photos.</p>}
          <ul className="grid grid-cols-2 gap-2.5">
            {items.map((item, i) => (
              <li key={item.id} className={i === 0 && items.length % 2 === 1 ? "col-span-2" : ""}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media[item.mediaId].url} alt={item.caption || ""} loading="lazy" className="aspect-[4/3] w-full rounded-[var(--radius)] object-cover" />
                  {item.caption && <figcaption className="mt-1 text-[12px] text-[var(--c-muted)]">{item.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "video":
      if (!block.provider || !block.videoId) {
        return mode === "preview" ? (
          <Section>
            <SectionTitle>{block.title}</SectionTitle>
            <p className="text-[13px] text-[var(--c-muted)]">Collez l&apos;adresse d&apos;une vidéo YouTube ou Vimeo.</p>
          </Section>
        ) : null;
      }
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          <VideoEmbed provider={block.provider} videoId={block.videoId} title={block.title} mode={mode} onPlay={() => track("video_play", block.provider ?? undefined)} />
        </Section>
      );

    case "documents": {
      const items = block.items.filter((i) => media[i.mediaId]);
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Ajoutez des documents PDF.</p>}
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <a href={`${media[item.mediaId].url}${media[item.mediaId].url.includes("?") ? "&" : "?"}telecharger=1`} {...linkProps(mode, false)} onClickCapture={() => track("download_pdf", item.id)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--c-line)] px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <FileText size={18} className="shrink-0 text-[var(--c-primary)]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{item.title || media[item.mediaId].name}</span>
                      <span className="block text-[12px] text-[var(--c-muted)]">PDF · {formatSize(media[item.mediaId].sizeBytes)}</span>
                    </span>
                  </span>
                  <Download size={18} className="shrink-0 text-[var(--c-muted)]" aria-label="Télécharger" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "appointment":
      if (!block.url && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {block.note && <p className="mb-3 text-[14px] text-[var(--c-muted)]">{block.note}</p>}
          <a href={block.url || "#"} {...linkProps(mode, true)} onClickCapture={() => track("click_appointment")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius)] border-[length:var(--border-w)] px-3 text-[14px] font-bold ${buttonClasses(theme.buttonStyle, theme.buttonStyle === "filled")}`}>
            <Calendar size={16} aria-hidden />
            {block.label || "Prendre rendez-vous"}
          </a>
          <p className="mt-2 text-[11px] text-[var(--c-muted)]">La réservation s&apos;effectue sur un service externe.</p>
        </Section>
      );

    case "hours":
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          <dl className="space-y-1.5 text-[14px]">
            {block.rows.filter((r) => r.day || r.value).map((r) => (
              <div key={r.id} className="flex justify-between gap-4">
                <dt className="flex items-center gap-2 text-[var(--c-muted)]"><Clock size={13} aria-hidden />{r.day}</dt>
                <dd className="text-right font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
          {block.note && <p className="mt-2 text-[12px] text-[var(--c-muted)]">{block.note}</p>}
        </Section>
      );

    case "services": {
      const items = block.items.filter((i) => i.name);
      if (!items.length && mode === "public") return null;
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          {!items.length && <p className="text-[13px] text-[var(--c-muted)]">Listez vos prestations.</p>}
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="border-l-[3px] border-[var(--c-primary)] pl-3">
                <p className="text-[14px] font-bold">{s.name}</p>
                {s.description && <p className="text-[13px] text-[var(--c-muted)]">{s.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "leadForm":
      return (
        <Section>
          <SectionTitle>{block.title}</SectionTitle>
          <LeadForm block={block} mode={mode} publicToken={props.publicToken} formToken={props.leadFormToken} company={doc.identity.company || [doc.identity.firstName, doc.identity.lastName].filter(Boolean).join(" ")} />
        </Section>
      );
  }
}

function VideoEmbed({ provider, videoId, title, mode, onPlay }: { provider: "youtube" | "vimeo"; videoId: string; title: string; mode: "public" | "preview"; onPlay: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const name = provider === "youtube" ? "YouTube" : "Vimeo";
  if (loaded && mode === "public") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius)] bg-black">
        <iframe src={videoEmbedUrl(provider, videoId)} title={title || `Vidéo ${name}`} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => { if (mode === "public") { setLoaded(true); onPlay(); } }}
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[var(--radius)] bg-[#14213d] p-4 text-center text-white">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15"><Play size={22} aria-hidden /></span>
      <span className="text-[14px] font-semibold">Lire la vidéo</span>
      <span className="text-[11px] text-white/75">La lecture charge un contenu de {name}, qui peut déposer ses propres traceurs.</span>
    </button>
  );
}

type LeadBlock = Extract<CardBlock, { type: "leadForm" }>;

function LeadForm({ block, mode, publicToken, formToken, company }: { block: LeadBlock; mode: "public" | "preview"; publicToken?: string; formToken?: string; company: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const fields = block.fields;
  const fieldDefs: { key: keyof LeadBlock["fields"]; label: string; type: string; autoComplete: string }[] = [
    { key: "name", label: "Nom", type: "text", autoComplete: "name" },
    { key: "email", label: "Email", type: "email", autoComplete: "email" },
    { key: "phone", label: "Téléphone", type: "tel", autoComplete: "tel" },
    { key: "company", label: "Société", type: "text", autoComplete: "organization" },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode !== "public" || !publicToken) return;
    setState("sending");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { token: publicToken, formToken };
    fd.forEach((v, k) => (body[k] = typeof v === "string" ? v : ""));
    body.marketingConsent = fd.get("marketingConsent") === "on";
    try {
      const res = await fetch("/api/public/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) setState("sent");
      else {
        setState("error");
        setError(data.error ?? "L'envoi a échoué. Réessayez dans un instant.");
      }
    } catch {
      setState("error");
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-[var(--radius)] bg-[var(--c-soft)] p-4 text-[14px]">
        <p className="font-bold">Message envoyé.</p>
        <p className="text-[var(--c-muted)]">Votre demande a bien été transmise à {company || "votre interlocuteur"}.</p>
      </div>
    );
  }

  const inputCls = "mt-1 block min-h-11 w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-card)] px-3 text-[15px] text-[var(--c-text)] focus:border-[var(--c-primary)]";
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate={mode === "preview"}>
      {block.intro && <p className="text-[14px] text-[var(--c-muted)]">{block.intro}</p>}
      {fieldDefs.filter((f) => fields[f.key] !== "off").map((f) => (
        <label key={f.key} className="block text-[13px] font-semibold">
          {f.label} {fields[f.key] === "required" ? <span aria-hidden className="text-[var(--c-primary)]">*</span> : <span className="font-normal text-[var(--c-muted)]">(facultatif)</span>}
          <input name={f.key} type={f.type} autoComplete={f.autoComplete} required={fields[f.key] === "required"} maxLength={f.key === "email" ? 254 : 120} className={inputCls} />
        </label>
      ))}
      {fields.message !== "off" && (
        <label className="block text-[13px] font-semibold">
          Message {fields.message === "required" ? <span aria-hidden className="text-[var(--c-primary)]">*</span> : <span className="font-normal text-[var(--c-muted)]">(facultatif)</span>}
          <textarea name="message" rows={4} maxLength={2000} required={fields.message === "required"} className={`${inputCls} py-2`} />
        </label>
      )}
      {/* Champ piège anti-robot, invisible pour les humains. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Ne pas remplir<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="flex items-start gap-2 text-[12px] text-[var(--c-muted)]">
        <input type="checkbox" name="marketingConsent" className="mt-0.5 h-4 w-4" />
        <span>J&apos;accepte de recevoir des informations commerciales de {company || "cet interlocuteur"} (facultatif).</span>
      </label>
      <p className="text-[11px] leading-snug text-[var(--c-muted)]">
        Vos informations sont transmises uniquement à {company || "votre interlocuteur"} pour répondre à votre demande. Indiquez au moins un email ou un téléphone.
      </p>
      {error && <p role="alert" className="text-[13px] font-semibold text-[#b42318]">{error}</p>}
      <button type="submit" disabled={state === "sending" || mode === "preview"} className="flex min-h-12 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--c-primary)] px-3 text-[14px] font-bold text-[var(--c-on-primary)] disabled:opacity-60">
        {state === "sending" ? "Envoi…" : block.buttonLabel || "Envoyer"}
      </button>
    </form>
  );
}

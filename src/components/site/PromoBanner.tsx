"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { PromoBanner as Banner } from "@/lib/config";

const noopSubscribe = () => () => {};

const TONES: Record<Banner["tone"], string> = {
  brand: "bg-brand text-white",
  dark: "bg-ink text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-ink",
};

/** Bannière promotionnelle. Masquable par visiteur (mémorisé localement, ré-affichée si le message change). */
export function PromoBanner({ banner }: { banner: Banner }) {
  const storageKey = `promo-dismissed:${banner.key}`;
  // Lu sans setState-dans-effet : côté serveur « non masquée », côté client la valeur stockée.
  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (banner.dismissible && (storedDismissed || dismissedNow)) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const isInternal = banner.ctaHref.startsWith("/");
  const cta = banner.ctaLabel && banner.ctaHref
    ? isInternal
      ? <Link href={banner.ctaHref} className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-sm font-bold underline-offset-2 hover:bg-white/30">{banner.ctaLabel}</Link>
      : <a href={banner.ctaHref} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-sm font-bold hover:bg-white/30">{banner.ctaLabel}</a>
    : null;

  return (
    <div role="region" aria-label="Annonce" className={`${TONES[banner.tone]} px-4 py-2`}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
        <p className="text-center text-sm font-semibold">{banner.message}</p>
        {cta}
        {banner.dismissible && (
          <button type="button" onClick={dismiss} aria-label="Masquer l'annonce" className="ml-auto shrink-0 rounded-full p-1 opacity-80 hover:bg-white/20 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

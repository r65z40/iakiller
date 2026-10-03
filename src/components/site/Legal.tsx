import type { ReactNode } from "react";
import { getSettings } from "@/lib/settings/store";
import type { LegalPageKey } from "@/lib/settings/schema";
import { RichText } from "@/components/card/RichText";
import { formatDate } from "@/lib/format";

/**
 * Page légale : affiche le texte définitif saisi dans l'administration s'il existe, sinon
 * le modèle alimenté par les réglages. Le bandeau « modèle à compléter » disparaît
 * uniquement lorsque la page est marquée validée par un professionnel.
 */
export async function LegalPage({ title, page, children }: { title: string; page: LegalPageKey; children: ReactNode }) {
  const settings = await getSettings();
  const cfg = settings.legal[page];
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {!cfg.validated && (
        <div role="note" className="mt-4 rounded-lg bg-[#fff6e6] p-3 text-sm text-[#7a3d00]">
          Document en cours de finalisation : il n&apos;a pas encore été validé juridiquement. Les mentions entre crochets restent à compléter.
        </div>
      )}
      {cfg.validated && cfg.validatedAt && <p className="text-sm text-muted">Version en vigueur au {formatDate(cfg.validatedAt)}.</p>}
      {cfg.customText.trim() ? <RichText text={cfg.customText} headings className="mt-4" /> : children}
    </article>
  );
}

export function Todo({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-[#fff1c2] px-1">[{children}]</mark>;
}

/** Valeur réglée, ou repère « à compléter » si elle est vide. */
export function Val({ v, todo }: { v: string | number | null | undefined; todo: string }) {
  if (v === null || v === undefined || v === "") return <Todo>{todo}</Todo>;
  return <>{v}</>;
}

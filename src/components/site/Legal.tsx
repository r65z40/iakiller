import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <div role="note" className="mt-4 rounded-lg bg-[#fff6e6] p-3 text-sm text-[#7a3d00]">
        Modèle de document à compléter et à faire valider par un professionnel du droit avant la mise en production. Les mentions entre crochets doivent être renseignées ; elles ne constituent pas une information exacte.
      </div>
      {children}
    </article>
  );
}

export function Todo({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-[#fff1c2] px-1">[{children}]</mark>;
}

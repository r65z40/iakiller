import type { Metadata } from "next";
import { FAQ } from "@/lib/content/faq";
import { JsonLd, faqLd, pageMeta } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMeta({
    title: "Questions fréquentes",
    description: "Essai sans carte bancaire, QR code permanent, résiliation, statistiques, création accompagnée : les réponses aux questions les plus courantes sur les cartes de visite numériques.",
    path: "/faq",
  });
}

export const dynamic = "force-dynamic";

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={faqLd(FAQ)} />
      <h1 className="text-3xl font-extrabold">Questions fréquentes</h1>
      <div className="mt-8 space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-xl p-4 ring-1 ring-line">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

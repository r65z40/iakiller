import type { Metadata } from "next";
import { DEMO_CARDS } from "@/lib/cards/demo";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { DemoCard } from "@/components/site/DemoCard";

export const metadata: Metadata = { title: "Modèles" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Trois modèles, un même contenu</h1>
      <p className="mt-2 max-w-2xl text-muted">Les modèles changent la présentation, jamais vos données : vous pouvez passer de l&apos;un à l&apos;autre à tout moment. Couleurs, police, arrondis et boutons se personnalisent. Ces démonstrations sont interactives et entièrement fictives.</p>
      <ul className="mt-10 grid gap-8 lg:grid-cols-3">
        {DEMO_CARDS.map((d) => (
          <li key={d.id}>
            <h2 className="text-lg font-bold">{d.template}</h2>
            <p className="mb-3 text-sm text-muted">{TEMPLATE_PRESETS[d.id as keyof typeof TEMPLATE_PRESETS]?.description}</p>
            <DemoCard id={d.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

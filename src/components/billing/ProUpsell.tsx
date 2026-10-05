import { ButtonLink, PageHeader } from "@/components/ui";

/** Écran affiché quand une fonctionnalité « Suite acquisition » n'est pas incluse dans la formule. */
export function ProUpsell({ title, feature, points }: { title: string; feature: string; points: string[] }) {
  return (
    <div className="max-w-2xl">
      <PageHeader title={title} description="Inclus à partir de la formule Pro." />
      <div className="rounded-2xl bg-gradient-to-br from-brand-soft to-white p-8 ring-1 ring-brand/15">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand ring-1 ring-brand/20">Formule Pro</span>
        <h2 className="mt-4 text-2xl font-extrabold">{feature}</h2>
        <ul className="mt-5 space-y-2 text-sm text-ink">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2"><span aria-hidden className="mt-0.5 text-brand">✓</span> <span>{p}</span></li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/app/abonnement" size="sm">Passer au Pro</ButtonLink>
          <ButtonLink href="/tarifs" variant="secondary" size="sm">Voir les formules</ButtonLink>
        </div>
      </div>
    </div>
  );
}

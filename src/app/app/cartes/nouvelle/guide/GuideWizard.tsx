"use client";

import { useMemo, useState, useTransition } from "react";
import { buildGuidedDocument, type GuidedAnswers } from "@/lib/cards/guided";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import type { TemplateId } from "@/lib/cards/document";
import { CardThumbnail } from "@/components/card/CardThumbnail";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createGuidedCardAction } from "../../../_actions/cards";

const COLORS = ["#0047BB", "#111827", "#0E7C66", "#B4232A", "#7A3DB8", "#C2410C", "#2563EB", "#0891B2"];
const STEPS = ["Vous", "Coordonnées", "Style"] as const;

export function GuideWizard({ defaultColor }: { defaultColor: string }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<GuidedAnswers>({ template: "classique", primaryColor: defaultColor });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<GuidedAnswers>) => setA((prev) => ({ ...prev, ...patch }));

  const previewDoc = useMemo(() => buildGuidedDocument(a), [a]);
  const canNext = step > 0 || Boolean((a.firstName && a.firstName.trim()) || (a.company && a.company.trim()));

  function submit() {
    setError(null);
    start(async () => {
      const r = await createGuidedCardAction(a);
      // En cas de succès, l'action redirige ; on n'arrive ici qu'en cas d'erreur.
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div>
        {/* Progression */}
        <ol className="mb-5 flex gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex-1 rounded-full px-3 py-1 text-center text-xs font-semibold ${i === step ? "bg-brand text-white" : i < step ? "bg-brand-soft text-brand" : "bg-surface text-muted"}`}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="fn"><Input id="fn" value={a.firstName ?? ""} onChange={(e) => set({ firstName: e.target.value })} placeholder="Camille" /></Field>
              <Field label="Nom" htmlFor="ln"><Input id="ln" value={a.lastName ?? ""} onChange={(e) => set({ lastName: e.target.value })} placeholder="Moreau" /></Field>
            </div>
            <Field label="Métier / fonction" htmlFor="jt"><Input id="jt" value={a.jobTitle ?? ""} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="Menuisière agenceuse" /></Field>
            <Field label="Entreprise" htmlFor="co"><Input id="co" value={a.company ?? ""} onChange={(e) => set({ company: e.target.value })} placeholder="Atelier Moreau" /></Field>
            <p className="text-xs text-muted">Indiquez au moins un prénom ou une entreprise pour continuer.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Field label="Téléphone mobile" htmlFor="mo"><Input id="mo" inputMode="tel" value={a.mobile ?? ""} onChange={(e) => set({ mobile: e.target.value })} placeholder="06 12 34 56 78" /></Field>
            <Field label="Email" htmlFor="em"><Input id="em" type="email" value={a.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="contact@exemple.fr" /></Field>
            <Field label="Site web" htmlFor="we"><Input id="we" value={a.website ?? ""} onChange={(e) => set({ website: e.target.value })} placeholder="www.exemple.fr" /></Field>
            <Field label="Adresse" htmlFor="ad"><Input id="ad" value={a.address ?? ""} onChange={(e) => set({ address: e.target.value })} placeholder="12 rue des Établis, 75000 Paris" /></Field>
            <p className="text-xs text-muted">Tout est facultatif : laissez vide ce que vous ne souhaitez pas afficher. Vous ajouterez photos, liens et horaires ensuite.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">Modèle</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(TEMPLATE_PRESETS) as TemplateId[]).map((id) => (
                  <button key={id} type="button" onClick={() => set({ template: id })} aria-pressed={a.template === id}
                    className={`rounded-xl p-2 text-left ring-1 transition ${a.template === id ? "ring-2 ring-brand" : "ring-line hover:bg-surface"}`}>
                    <span className="block text-sm font-bold">{TEMPLATE_PRESETS[id].label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{TEMPLATE_PRESETS[id].description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Couleur principale</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set({ primaryColor: c })} aria-label={`Couleur ${c}`} aria-pressed={a.primaryColor === c}
                    className={`h-9 w-9 rounded-full ring-2 ${a.primaryColor === c ? "ring-ink" : "ring-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div className="mt-4"><Alert tone="danger">{error}</Alert></div>}

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Précédent</Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continuer →</Button>
          ) : (
            <Button type="button" disabled={pending} onClick={submit}>{pending ? "Création…" : "Créer ma carte"}</Button>
          )}
        </div>
      </div>

      {/* Aperçu en direct */}
      <div className="lg:sticky lg:top-6">
        <p className="mb-2 text-center text-xs font-semibold text-muted">Aperçu</p>
        <div className="flex justify-center rounded-2xl bg-surface p-5">
          <CardThumbnail doc={previewDoc} />
        </div>
      </div>
    </div>
  );
}

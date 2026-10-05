"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, STAGES } from "@/lib/leads/crm";
import { createAutomationAction, deleteAutomationAction, toggleAutomationAction } from "./actions";

interface Rule { id: string; name: string; enabled: boolean; action: string; summary: string }

const DELAYS = [
  { h: 1, label: "1 heure" },
  { h: 24, label: "1 jour" },
  { h: 48, label: "2 jours" },
  { h: 72, label: "3 jours" },
  { h: 168, label: "7 jours" },
  { h: 336, label: "14 jours" },
  { h: 720, label: "30 jours" },
];

export function RulesManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [trigger, setTrigger] = useState("stage_entered");
  const [action, setAction] = useState("email");
  const [error, setError] = useState<string | null>(null);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const input = {
      name: String(fd.get("name") ?? ""),
      trigger: String(fd.get("trigger") ?? ""),
      triggerStage: String(fd.get("triggerStage") ?? ""),
      delayHours: Number(fd.get("delayHours") ?? 24),
      action: String(fd.get("action") ?? ""),
      emailSubject: String(fd.get("emailSubject") ?? ""),
      emailBody: String(fd.get("emailBody") ?? ""),
      taskTitle: String(fd.get("taskTitle") ?? ""),
    };
    setError(null);
    start(async () => {
      const r = await createAutomationAction(input);
      if (r.ok) { form.reset(); setTrigger("stage_entered"); setAction("email"); router.refresh(); }
      else setError(r.error);
    });
  }

  const field = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm";
  const needStage = trigger === "stage_entered";

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-line">
            <div>
              <p className="font-semibold">{r.name} {!r.enabled && <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-line">en pause</span>}</p>
              <p className="text-sm text-muted">{r.summary}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pending} className={buttonClass("secondary", "sm")}
                onClick={() => start(async () => { await toggleAutomationAction(r.id, !r.enabled); router.refresh(); })}>
                {r.enabled ? "Mettre en pause" : "Activer"}
              </button>
              <button type="button" disabled={pending} className={buttonClass("ghost", "sm")}
                onClick={() => { if (window.confirm("Supprimer cette règle ?")) start(async () => { await deleteAutomationAction(r.id); router.refresh(); }); }}>
                Supprimer
              </button>
            </div>
          </li>
        ))}
        {rules.length === 0 && <li className="rounded-xl bg-surface/60 p-6 text-center text-sm text-muted ring-1 ring-line">{"Aucune règle pour l'instant. Créez-en une ci-dessous."}</li>}
      </ul>

      <form onSubmit={onCreate} className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="text-base font-bold">Nouvelle règle</h2>
        <label className="block text-[13px] font-semibold">Nom de la règle
          <input name="name" maxLength={80} required placeholder="Ex. Relancer les devis envoyés" className={field} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-semibold">Déclencheur
            <select name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)} className={field}>
              {AUTOMATION_TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="block text-[13px] font-semibold">
            {needStage ? "Étape" : "Étape (facultatif)"}
            <select name="triggerStage" defaultValue={needStage ? "devis_envoye" : ""} className={field}>
              {!needStage && <option value="">Toutes les étapes ouvertes</option>}
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-[13px] font-semibold">Délai
          <select name="delayHours" defaultValue={72} className={field}>
            {DELAYS.map((d) => <option key={d.h} value={d.h}>{d.label}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">
            {needStage ? "Après l'arrivée du prospect dans l'étape choisie." : "Après la dernière activité enregistrée sur le prospect."}
          </span>
        </label>

        <label className="block text-[13px] font-semibold">Action
          <select name="action" value={action} onChange={(e) => setAction(e.target.value)} className={field}>
            {AUTOMATION_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>

        {action === "email" ? (
          <div className="space-y-3 rounded-lg bg-surface/60 p-3">
            <label className="block text-[13px] font-semibold">{"Objet de l'email"}
              <input name="emailSubject" maxLength={150} placeholder="Avez-vous reçu notre devis ?" className={field} />
            </label>
            <label className="block text-[13px] font-semibold">Message
              <textarea name="emailBody" rows={4} maxLength={4000} placeholder={"Bonjour,\n\nNous revenons vers vous concernant votre demande…"} className={`${field} py-2`} />
            </label>
            <p className="text-xs text-muted">{"L'email n'est envoyé qu'aux prospects dont l'adresse est connue."}</p>
          </div>
        ) : (
          <label className="block text-[13px] font-semibold">Intitulé de la tâche
            <input name="taskTitle" maxLength={200} placeholder="Rappeler le prospect" className={field} />
          </label>
        )}

        {error && <p role="alert" className="text-sm text-[#b00020]">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>{pending ? "Enregistrement…" : "Créer la règle"}</button>
      </form>
    </div>
  );
}

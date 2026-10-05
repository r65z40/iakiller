"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { STAGES } from "@/lib/leads/crm";
import { addLeadTaskAction, deleteLeadAction, deleteLeadTaskAction, toggleLeadTaskAction, updateLeadAction } from "../actions";

interface Task { id: string; title: string; dueAt: string | null; done: boolean }
interface Member { id: string; name: string }

export function LeadDetail({
  leadId, canManage, stage: initialStage, notes: initialNotes, tags: initialTags,
  assignedToId: initialAssignee, assigneeName, members, tasks: initialTasks,
}: {
  leadId: string;
  canManage: boolean;
  stage: string;
  notes: string;
  tags: string[];
  assignedToId: string | null;
  assigneeName: string | null;
  members: Member[];
  tasks: Task[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState(initialStage);
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [assignee, setAssignee] = useState(initialAssignee ?? "");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function note(r: { ok: boolean; error?: string }, ok: string) {
    setMsg(r.ok ? ok : r.error ?? "Erreur.");
  }

  function save(patch: Parameters<typeof updateLeadAction>[1], ok: string) {
    start(async () => {
      const r = await updateLeadAction(leadId, patch);
      note(r, ok);
      if (r.ok) router.refresh();
    });
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t].slice(0, 20);
    setTags(next);
    setTagInput("");
    save({ tags: next }, "Étiquettes enregistrées.");
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    save({ tags: next }, "Étiquettes enregistrées.");
  }

  function addTask() {
    const title = taskTitle.trim();
    if (!title) return;
    start(async () => {
      const r = await addLeadTaskAction(leadId, title, taskDue || null);
      note(r, "Tâche ajoutée.");
      if (r.ok) { setTaskTitle(""); setTaskDue(""); router.refresh(); }
    });
  }

  function toggleTask(task: Task) {
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)));
    start(async () => { await toggleLeadTaskAction(task.id, leadId, done); router.refresh(); });
  }

  function removeTask(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    start(async () => { await deleteLeadTaskAction(task.id, leadId); router.refresh(); });
  }

  const field = "min-h-10 w-full rounded-lg border border-line px-3 text-sm";

  return (
    <aside className="space-y-4">
      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <label htmlFor="stage" className="text-sm font-bold">Étape du pipeline</label>
        <select
          id="stage" value={stage} disabled={pending}
          onChange={(e) => { setStage(e.target.value); save({ stage: e.target.value }, "Étape mise à jour."); }}
          className={`mt-2 ${field}`}
        >
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="text-sm font-bold">Responsable</h2>
        {canManage ? (
          <select
            value={assignee} disabled={pending}
            onChange={(e) => { setAssignee(e.target.value); save({ assignedToId: e.target.value || null }, "Responsable mis à jour."); }}
            className={`mt-2 ${field}`}
          >
            <option value="">Non attribué</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <p className="mt-2 text-sm text-muted">{assigneeName || "Non attribué"}</p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="text-sm font-bold">Étiquettes</h2>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {t}
              <button type="button" aria-label={`Retirer ${t}`} disabled={pending} onClick={() => removeTag(t)} className="text-brand/60 hover:text-brand">×</button>
            </span>
          ))}
          {tags.length === 0 && <span className="text-xs text-muted">Aucune étiquette.</span>}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={tagInput} onChange={(e) => setTagInput(e.target.value)} maxLength={40} placeholder="Ajouter…"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            className={field}
          />
          <button type="button" disabled={pending} onClick={addTag} className={buttonClass("secondary", "sm")}>Ajouter</button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="text-sm font-bold">Tâches &amp; rappels</h2>
        <ul className="mt-2 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={t.done} disabled={pending} onChange={() => toggleTask(t)} className="mt-0.5 h-4 w-4" />
              <span className={`flex-1 ${t.done ? "text-muted line-through" : ""}`}>
                {t.title}
                {t.dueAt && <span className="block text-xs text-muted">échéance : {new Date(t.dueAt).toLocaleDateString("fr-FR")}</span>}
              </span>
              <button type="button" aria-label="Supprimer la tâche" disabled={pending} onClick={() => removeTask(t)} className="text-muted hover:text-ink">×</button>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-xs text-muted">Aucune tâche.</li>}
        </ul>
        <div className="mt-3 space-y-2">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={200} placeholder="Nouvelle tâche…" className={field} />
          <div className="flex gap-2">
            <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className={field} />
            <button type="button" disabled={pending} onClick={addTask} className={buttonClass("secondary", "sm")}>Ajouter</button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-line">
        <label htmlFor="notes" className="text-sm font-bold">Notes privées</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={4000} className="mt-2 block w-full rounded-lg border border-line px-3 py-2 text-sm" />
        <button type="button" disabled={pending} onClick={() => save({ notes }, "Notes enregistrées.")} className={`mt-2 ${buttonClass("secondary", "sm")}`}>Enregistrer les notes</button>
      </section>

      {canManage && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-line">
          <button
            type="button" disabled={pending}
            onClick={() => { if (window.confirm("Supprimer définitivement ce prospect ?")) start(async () => { const r = await deleteLeadAction(leadId); if (r.ok) router.push("/app/prospects"); else note(r, ""); }); }}
            className={buttonClass("ghost", "sm")}
          >
            Supprimer le prospect
          </button>
        </section>
      )}

      {msg && <p role="status" className="text-xs text-muted">{msg}</p>}
    </aside>
  );
}

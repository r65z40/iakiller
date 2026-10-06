"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type Announcements, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { STAGES, STAGE_LABELS } from "@/lib/leads/crm";
import { moveLeadStageAction } from "./actions";

export interface BoardLead {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  source: string;
  sourceLabel: string;
  tags: string[];
  assigneeName: string | null;
  cardTitle: string;
  createdAt: string;
}

function Card({ lead, dragging }: { lead: BoardLead; dragging?: boolean }) {
  return (
    <div className={`rounded-lg bg-white p-3 text-sm ring-1 ring-line ${dragging ? "rotate-1 shadow-lg" : "shadow-sm"}`}>
      <p className="font-semibold leading-tight">{lead.name || "Sans nom"}</p>
      {lead.company && <p className="text-xs text-muted">{lead.company}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">{lead.sourceLabel}</span>
        {lead.tags.map((t) => (
          <span key={t} className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">{t}</span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {lead.createdAt}
        {lead.assigneeName ? ` · ${lead.assigneeName}` : ""}
      </p>
    </div>
  );
}

function DraggableCard({ lead }: { lead: BoardLead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { stage: lead.stage } });
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-40" : ""}>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          aria-label="Déplacer le prospect"
          className="shrink-0 cursor-grab touch-none rounded-l-lg px-1 text-muted hover:bg-surface active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <Link href={`/app/prospects/${lead.id}`} className="block flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg">
          <Card lead={lead} />
        </Link>
      </div>
    </div>
  );
}

function Column({ id, label, leads }: { id: string; label: string; leads: BoardLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-bold">
        <span>{label}</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">{leads.length}</span>
      </h2>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl p-2 ring-1 transition-colors ${isOver ? "bg-brand/5 ring-brand" : "bg-surface/60 ring-line"}`}
      >
        {leads.map((lead) => <DraggableCard key={lead.id} lead={lead} />)}
        {leads.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted">—</p>}
      </div>
    </section>
  );
}

export function Board({ initialLeads }: { initialLeads: BoardLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Annonces pour les lecteurs d'écran (déplacement au clavier : Espace puis flèches).
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Prospect « ${leads.find((l) => l.id === String(active.id))?.name || "sans nom"} » saisi. Utilisez les flèches pour choisir une étape, Espace pour déposer.`,
    onDragOver: ({ over }) => (over ? `Sur la colonne ${STAGE_LABELS[String(over.id)] ?? String(over.id)}.` : ""),
    onDragEnd: ({ over }) => (over ? `Déposé dans ${STAGE_LABELS[String(over.id)] ?? String(over.id)}.` : "Déplacement annulé."),
    onDragCancel: () => "Déplacement annulé.",
  };

  const byStage = useMemo(() => {
    const map: Record<string, BoardLead[]> = {};
    for (const s of STAGES) map[s.id] = [];
    for (const l of leads) (map[l.stage] ??= []).push(l);
    return map;
  }, [leads]);

  const active = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === over) return;
    const previous = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: over } : l)));
    start(async () => {
      const r = await moveLeadStageAction(id, over);
      if (!r.ok) setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: previous } : l)));
    });
  }

  return (
    <DndContext sensors={sensors} accessibility={{ announcements }} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => <Column key={s.id} id={s.id} label={s.label} leads={byStage[s.id] ?? []} />)}
      </div>
      <DragOverlay>{active ? <div className="w-64"><Card lead={active} dragging /></div> : null}</DragOverlay>
    </DndContext>
  );
}

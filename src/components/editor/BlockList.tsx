"use client";

import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import type { CardBlock } from "@/lib/cards/document";
import { blockLabel } from "@/lib/cards/defaults";

function blockSummary(b: CardBlock): string {
  switch (b.type) {
    case "contacts":
    case "links":
    case "social":
    case "gallery":
    case "documents":
    case "services":
      return `${b.title || blockLabel(b.type)} · ${b.items.length} élément(s)`;
    case "hours":
      return b.title || "Horaires";
    case "actions":
      return [b.showCall && "Appeler", b.showEmail && "Email", b.showVcard && "Contact"].filter(Boolean).join(" · ") || "Aucun bouton";
    default:
      return "title" in b && b.title ? b.title : blockLabel(b.type);
  }
}

function Row({
  block, index, count, selected, onSelect, onMove, onToggle, onDuplicate, onDelete,
}: {
  block: CardBlock; index: number; count: number; selected: boolean;
  onSelect: () => void; onMove: (dir: -1 | 1) => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const label = blockLabel(block.type);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg bg-white ring-1 ${selected ? "ring-2 ring-brand" : "ring-line"} ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <div className="flex items-start gap-1 p-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Déplacer le bloc ${label} (glisser, ou Espace puis flèches au clavier)`}
          className="flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted hover:bg-surface active:cursor-grabbing"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
        <button type="button" onClick={onSelect} aria-pressed={selected} className="w-full rounded px-1 py-1 text-left">
          <span className={`block truncate text-sm font-semibold ${block.hidden ? "text-muted line-through" : ""}`}>{label}{block.hidden && <span className="sr-only"> (masqué)</span>}</span>
          <span className="block truncate text-xs text-muted">{blockSummary(block)}</span>
        </button>
        <div className="flex items-center justify-end">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter ${label}`} className="flex h-8 w-7 items-center justify-center rounded text-muted hover:bg-surface disabled:opacity-30"><ArrowUp size={15} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre ${label}`} className="flex h-8 w-7 items-center justify-center rounded text-muted hover:bg-surface disabled:opacity-30"><ArrowDown size={15} /></button>
          <button type="button" onClick={onToggle} aria-label={block.hidden ? `Afficher ${label}` : `Masquer ${label}`} className="flex h-8 w-7 items-center justify-center rounded text-muted hover:bg-surface">{block.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button type="button" onClick={onDuplicate} aria-label={`Dupliquer ${label}`} className="flex h-8 w-7 items-center justify-center rounded text-muted hover:bg-surface"><Copy size={15} /></button>
          <button type="button" onClick={onDelete} aria-label={`Supprimer ${label}`} className="flex h-8 w-7 items-center justify-center rounded text-muted hover:bg-[#fdecea] hover:text-danger"><Trash2 size={15} /></button>
        </div>
        </div>
      </div>
    </li>
  );
}

export function BlockList({
  blocks, selectedId, onSelect, onReorder, onToggle, onDuplicate, onDelete,
}: {
  blocks: CardBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (blocks: CardBlock[]) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(blocks, from, to));
  };

  const nameOf = (id: string | number) => blockLabel(blocks.find((b) => b.id === id)?.type ?? "about");
  const position = (id: string | number) => blocks.findIndex((b) => b.id === id) + 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Bloc ${nameOf(active.id)} saisi, position ${position(active.id)} sur ${blocks.length}.`,
          onDragOver: ({ active, over }) => (over ? `Bloc ${nameOf(active.id)} au-dessus de la position ${position(over.id)}.` : `Bloc ${nameOf(active.id)} hors de la liste.`),
          onDragEnd: ({ active, over }) => (over ? `Bloc ${nameOf(active.id)} déposé en position ${position(over.id)}.` : `Bloc ${nameOf(active.id)} déposé.`),
          onDragCancel: ({ active }) => `Déplacement du bloc ${nameOf(active.id)} annulé.`,
        },
        screenReaderInstructions: {
          draggable: "Pour déplacer un bloc, appuyez sur Espace, utilisez les flèches haut et bas, puis Espace pour déposer ou Échap pour annuler.",
        },
      }}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2" aria-label="Blocs de la carte">
          {blocks.map((b, i) => (
            <Row
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              selected={selectedId === b.id}
              onSelect={() => onSelect(b.id)}
              onMove={(dir) => {
                const to = i + dir;
                if (to < 0 || to >= blocks.length) return;
                onReorder(arrayMove(blocks, i, to));
              }}
              onToggle={() => onToggle(b.id)}
              onDuplicate={() => onDuplicate(b.id)}
              onDelete={() => onDelete(b.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

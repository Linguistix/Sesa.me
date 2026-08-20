"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { deleteLinkAction, reorderLinksAction, toggleLinkAction } from "@/actions/page";
import type { EditorLink } from "./types";
import { LinkForm } from "./LinkForm";

const TYPE_LABEL: Record<EditorLink["type"], string> = {
  LINK: "Lien",
  SOCIAL: "Réseau social",
  HEADING: "Titre",
  TEXT: "Texte",
};

/**
 * The reorderable block list.
 *
 * Order is applied optimistically so a drag feels instant, then persisted.
 * `useOptimistic` rolls the list back on its own if the action throws, so a
 * failed save cannot leave the UI showing an order the database rejected.
 */
export function LinkList({ links }: { links: EditorLink[] }) {
  const [optimisticLinks, setOptimisticOrder] = useOptimistic(
    links,
    (current: EditorLink[], orderedIds: string[]) => {
      const byId = new Map(current.map((l) => [l.id, l]));
      return orderedIds.flatMap((id) => byId.get(id) ?? []);
    },
  );

  const [isSaving, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps a click on "Modifier" from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimisticLinks.findIndex((l) => l.id === active.id);
    const newIndex = optimisticLinks.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const orderedIds = arrayMove(optimisticLinks, oldIndex, newIndex).map((l) => l.id);

    startTransition(async () => {
      setOptimisticOrder(orderedIds);
      await reorderLinksAction(orderedIds);
      setSavedAt(Date.now());
    });
  }

  if (links.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-neutral-400">
        Aucun bloc pour l&apos;instant. Ajoutez votre premier lien ci-dessous.
      </p>
    );
  }

  return (
    <>
      {/* Reordering saves in the background, so the list says so — otherwise a
          user who drags and immediately navigates away cannot tell whether the
          new order was kept. */}
      <p
        role="status"
        aria-live="polite"
        data-reorder-state={isSaving ? "saving" : savedAt ? "saved" : "idle"}
        className="mb-2 h-4 text-xs text-neutral-500"
      >
        {isSaving ? "Enregistrement de l’ordre…" : savedAt ? "Ordre enregistré." : ""}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticLinks.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul aria-label="Blocs de la page" className="flex flex-col gap-2">
            {optimisticLinks.map((link) => (
              <SortableRow
                key={link.id}
                link={link}
                isEditing={editingId === link.id}
                onEdit={() => setEditingId(editingId === link.id ? null : link.id)}
                onDone={() => setEditingId(null)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableRow({
  link,
  isEditing,
  onEdit,
  onDone,
}: {
  link: EditorLink;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });
  const [, startTransition] = useTransition();

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "rounded-xl border border-white/10 bg-white/[0.03]",
        isDragging ? "z-10 opacity-90 shadow-2xl" : "",
        link.isActive ? "" : "opacity-55",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="cursor-grab touch-none rounded-md px-1.5 py-1 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 active:cursor-grabbing"
          aria-label={`Déplacer « ${link.title} ». Utilisez les flèches pour réordonner.`}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden>⠿</span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">
            {link.emoji ? <span className="mr-1.5">{link.emoji}</span> : null}
            {link.title}
            {link.hasPassword ? (
              <span aria-label="protégé par mot de passe" className="ml-1.5 text-xs">
                🔒
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {TYPE_LABEL[link.type]}
            {link.url ? ` · ${link.url}` : ""}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={link.isActive}
            onChange={(e) => {
              const next = e.target.checked;
              startTransition(async () => {
                await toggleLinkAction(link.id, next);
              });
            }}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="sr-only sm:not-sr-only">Visible</span>
        </label>

        <button
          type="button"
          onClick={onEdit}
          aria-expanded={isEditing}
          className="rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5"
        >
          {isEditing ? "Fermer" : "Modifier"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!confirm(`Supprimer « ${link.title} » ?`)) return;
            startTransition(async () => {
              await deleteLinkAction(link.id);
            });
          }}
          className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
        >
          Supprimer
        </button>
      </div>

      {isEditing ? (
        <div className="border-t border-white/10 p-3">
          <LinkForm mode="edit" link={link} onDone={onDone} />
        </div>
      ) : null}
    </li>
  );
}

"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
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
import { BLOCK_GLYPHS, BLOCK_LABELS } from "@/lib/block-types";
import { Switch } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/Panel";
import { LinkForm } from "./LinkForm";

/**
 * dnd-kit announces drag state to screen readers in English by default, which
 * would be the only English in the interface. These are the French equivalents,
 * and they name the block rather than its id so the announcement is useful.
 */
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Pour réordonner ce bloc, appuyez sur Espace ou Entrée. " +
    "Utilisez ensuite les flèches haut et bas pour le déplacer, " +
    "Espace ou Entrée pour valider, ou Échap pour annuler.",
};

function announcementsFor(links: EditorLink[]): Announcements {
  const titleOf = (id: string | number) =>
    links.find((l) => l.id === id)?.title ?? String(id);

  return {
    onDragStart: ({ active }) => `Bloc « ${titleOf(active.id)} » saisi.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Bloc « ${titleOf(active.id)} » déplacé au-dessus de « ${titleOf(over.id)} ».`
        : `Bloc « ${titleOf(active.id)} » déplacé hors de la liste.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Bloc « ${titleOf(active.id)} » déposé à la place de « ${titleOf(over.id)} ».`
        : `Bloc « ${titleOf(active.id)} » reposé à sa place.`,
    onDragCancel: ({ active }) =>
      `Déplacement annulé. Le bloc « ${titleOf(active.id)} » reste à sa place.`,
  };
}


/**
 * The reorderable block list.
 *
 * Order is applied optimistically so a drag feels instant, then persisted.
 * `useOptimistic` rolls the list back on its own if the action throws, so a
 * failed save cannot leave the UI showing an order the database rejected.
 */
export function LinkList({
  links,
  storageEnabled = false,
  syncProviders = [],
}: {
  links: EditorLink[];
  storageEnabled?: boolean;
  syncProviders?: Array<{ value: string; label: string }>;
}) {
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
      <EmptyState
        title="Votre page est vide"
        description="Ajoutez un premier bloc ci-dessous — un lien, un lecteur, une galerie. Vous pourrez les réordonner par glisser-déposer."
      />
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
        className="mb-2 flex h-4 items-center gap-1.5 text-xs text-ink-500"
      >
        {isSaving ? (
          <>
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
            Enregistrement de l&rsquo;ordre&hellip;
          </>
        ) : savedAt ? (
          <>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-positive-500" />
            Ordre enregistré.
          </>
        ) : null}
      </p>

      <DndContext
        accessibility={{
          announcements: announcementsFor(optimisticLinks),
          screenReaderInstructions,
        }}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticLinks.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul aria-label="Blocs de la page" className="flex flex-col gap-1.5">
            {optimisticLinks.map((link) => (
              <SortableRow
                key={link.id}
                link={link}
                storageEnabled={storageEnabled}
                syncProviders={syncProviders}
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
  storageEnabled,
  syncProviders,
  isEditing,
  onEdit,
  onDone,
}: {
  link: EditorLink;
  storageEnabled: boolean;
  syncProviders: Array<{ value: string; label: string }>;
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
        "group rounded-lg bg-ink-880 ring-1 ring-inset transition-shadow duration-[120ms]",
        isDragging ? "z-10 shadow-float ring-accent-400/40" : "ring-white/7 hover:ring-white/12",
        link.isActive ? "" : "opacity-55",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 p-2.5">
        <button
          type="button"
          className="cursor-grab touch-none rounded-md px-1 py-1.5 text-ink-600 transition-colors hover:bg-white/6 hover:text-ink-200 active:cursor-grabbing"
          aria-label={`Déplacer « ${link.title} ». Utilisez les flèches pour réordonner.`}
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 10 16" aria-hidden className="h-4 w-4">
            <circle cx="3" cy="3" r="1.2" fill="currentColor" />
            <circle cx="7" cy="3" r="1.2" fill="currentColor" />
            <circle cx="3" cy="8" r="1.2" fill="currentColor" />
            <circle cx="7" cy="8" r="1.2" fill="currentColor" />
            <circle cx="3" cy="13" r="1.2" fill="currentColor" />
            <circle cx="7" cy="13" r="1.2" fill="currentColor" />
          </svg>
        </button>

        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-800 text-base ring-1 ring-inset ring-white/6"
        >
          {link.emoji || BLOCK_GLYPHS[link.type]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-base font-medium text-ink-50">
            {link.title}
            {link.hasPassword ? (
              <span aria-label="protégé par mot de passe" title="Protégé par mot de passe">
                <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 text-ink-400">
                  <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5M2.5 5h7v5h-7z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-ink-500">
            {BLOCK_LABELS[link.type]}
            {link.syncProvider ? " · synchronisé" : ""}
            {link.url ? ` · ${link.url.replace(/^https?:\/\//, "")}` : ""}
          </p>
          {link.syncError ? (
            <p className="truncate text-xs text-caution-400">{link.syncError}</p>
          ) : null}
        </div>

        {/*
          The row's controls only appear on hover or focus. A list of ten
          blocks otherwise shows thirty buttons at once, and the content —
          which is what the creator is scanning — loses to the chrome.
        */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-[120ms] focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={isEditing}
            className="rounded-md px-2.5 py-1.5 text-xs text-ink-300 transition-colors hover:bg-white/6 hover:text-ink-50"
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
            aria-label={`Supprimer « ${link.title} »`}
            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-critical-500/12 hover:text-critical-400"
          >
            <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5">
              <path d="M2.5 3.5h9M5.5 3.5V2h3v1.5M4 3.5l.5 8h5l.5-8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <Switch
          checked={link.isActive}
          label={`${link.title} — visible sur la page`}
          onChange={(next) =>
            startTransition(async () => {
              await toggleLinkAction(link.id, next);
            })
          }
        />
      </div>

      {isEditing ? (
        <div className="border-t border-white/8 p-3">
          <LinkForm
            mode="edit"
            link={link}
            onDone={onDone}
            storageEnabled={storageEnabled}
            syncProviders={syncProviders}
          />
        </div>
      ) : null}
    </li>
  );
}

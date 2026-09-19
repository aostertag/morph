import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { Habit } from '@/domain/types';
import { cx } from '@/lib/cx';

interface SortableHabitListProps {
  readonly habits: readonly Habit[];
  readonly onReorder: (ids: string[]) => void;
  /** Contenido de cada fila, a la derecha del asa de arrastre. */
  readonly renderRow: (habit: Habit, index: number) => ReactNode;
}

function SortableRow({ habit, children }: { habit: Habit; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
      }}
      className={cx(
        'relative flex min-h-14 items-stretch border-b border-border bg-bg',
        isDragging && 'z-10 bg-surface shadow-overlay',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${habit.name}`}
        className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center text-text-faint hover:text-text active:cursor-grabbing"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      {children}
    </li>
  );
}

export function SortableHabitList({ habits, onReorder, renderRow }: SortableHabitListProps) {
  // Orden optimista mientras la base de datos confirma el cambio (evita un salto visual).
  // Solo se usa mientras la lista de la base de datos siga siendo la de antes del arrastre.
  const [pending, setPending] = useState<{ base: string; next: string[] } | null>(null);
  const ids = habits.map((h) => h.id);
  const order = pending && pending.base === ids.join() ? pending.next : ids;
  const byId = new Map(habits.map((h) => [h.id, h]));
  const ordered = order.map((id) => byId.get(id)).filter((h): h is Habit => h !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string | number) => byId.get(String(id))?.name ?? 'El hábito';
  const positionOf = (id: string | number) => order.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Has cogido ${nameOf(active.id)}. Posición ${positionOf(active.id)} de ${order.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} está sobre la posición ${positionOf(over.id)} de ${order.length}.`
        : `${nameOf(active.id)} está fuera de la lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} soltado en la posición ${positionOf(over.id)} de ${order.length}.`
        : `${nameOf(active.id)} soltado.`,
    onDragCancel: ({ active }) => `Movimiento cancelado. ${nameOf(active.id)} vuelve a su sitio.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setPending({ base: ids.join(), next });
    onReorder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para reordenar, pulsa espacio o intro para coger el hábito, muévelo con las flechas arriba y abajo, y vuelve a pulsar espacio o intro para soltarlo. Escape cancela.',
        },
      }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="border-t border-border">
          {ordered.map((habit, index) => (
            <SortableRow key={habit.id} habit={habit}>
              {renderRow(habit, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

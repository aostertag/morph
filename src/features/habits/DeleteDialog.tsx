import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { countEntries } from '@/db/repos/entries';
import type { Habit } from '@/domain/types';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { remove } from './habitActions';

/** Confirmación de borrado: dice cuántos registros se pierden. */
export function DeleteDialog({
  habit: requested,
  onClose,
  onDeleted,
}: {
  habit: Habit | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  // Se conserva el último hábito para que el texto no desaparezca durante la animación de cierre.
  const [habit, setHabit] = useState(requested);
  if (requested && requested !== habit) setHabit(requested);
  const count = useLiveQuery(
    () => (habit ? countEntries(habit.id) : Promise.resolve(0)),
    [habit?.id],
  );
  const records =
    count === undefined ? 'sus registros' : count === 1 ? 'su registro' : `sus ${count} registros`;

  return (
    <ConfirmDialog
      open={requested !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`¿Eliminar «${habit?.name ?? ''}»?`}
      description={
        count === 0
          ? 'Todavía no tiene registros.'
          : `Se borrarán también ${records}. Si solo quieres dejar de verlo, archívalo: el historial se conserva.`
      }
      confirmLabel="Eliminar"
      destructive
      onConfirm={() => {
        if (!habit) return;
        void remove(habit);
        onDeleted?.();
      }}
    />
  );
}

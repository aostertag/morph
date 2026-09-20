import { Plus } from 'lucide-react';
import { useState } from 'react';
import { diffDays, type LocalDay } from '@/domain/day';
import type { Habit, Pause } from '@/domain/types';
import { useToday } from '@/hooks/useToday';
import { describeRange, formatNumber } from '@/lib/format';
import { ActionsMenu } from '@/ui/ActionsMenu';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ColorBar } from '@/ui/HabitMarks';
import { PauseForm, REASON_LABEL, scopeName } from './PauseForm';
import { addPause, editPause, removePause } from './pauseActions';

function status(pause: Pause, today: LocalDay): string {
  if (pause.end < today) return 'Terminada';
  if (pause.start > today) return 'Próxima';
  return 'En curso';
}

function PauseRow({
  pause,
  habits,
  today,
  onEdit,
  onDelete,
}: {
  pause: Pause;
  habits: readonly Habit[];
  today: LocalDay;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const habit = habits.find((h) => h.id === pause.habitId);
  const name = scopeName(pause.habitId, habits);
  const days = diffDays(pause.start, pause.end) + 1;
  return (
    <li className="flex min-h-14 items-stretch gap-3 border-b border-border">
      <ColorBar color={habit?.color ?? null} />
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate">{name}</p>
          <p className="shrink-0 whitespace-nowrap text-sm text-text-muted">
            {status(pause, today)}
          </p>
        </div>
        <p className="text-sm text-text-muted">
          {describeRange({ from: pause.start, to: pause.end }, today)} · {formatNumber(days)}{' '}
          {days === 1 ? 'día' : 'días'} · {REASON_LABEL[pause.reason]}
          {pause.note ? ` · ${pause.note}` : ''}
        </p>
      </div>
      <div className="flex items-center">
        <ActionsMenu
          label={`Acciones de la pausa de ${name}`}
          actions={[
            { label: 'Editar', onSelect: onEdit },
            { label: 'Eliminar', onSelect: onDelete, destructive: true },
          ]}
        />
      </div>
    </li>
  );
}

/** Pausas globales y por hábito: días que no cuentan ni a favor ni en contra. */
export function PausesSection({
  pauses,
  habits,
}: {
  pauses: readonly Pause[];
  habits: readonly Habit[];
}) {
  const today = useToday();
  // `undefined` = formulario cerrado; `null` = pausa nueva; una pausa = editándola.
  const [editing, setEditing] = useState<Pause | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Pause | null>(null);

  const sorted = [...pauses].sort((a, b) => b.start.localeCompare(a.start));

  return (
    <section aria-labelledby="pausas" className="mt-12">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-2">
        <h2 id="pausas" className="label-caps">
          Pausas
        </h2>
        {editing === undefined && (
          <Button onClick={() => setEditing(null)}>
            <Plus size={18} aria-hidden="true" />
            Añadir pausa
          </Button>
        )}
      </div>
      <p className="mt-3 max-w-prose text-md text-text-muted">
        Los días en pausa no cuentan ni a favor ni en contra: no rompen rachas, no bajan los
        porcentajes y no aparecen como pendientes en Hoy.
      </p>

      {editing !== undefined && (
        <PauseForm
          key={editing?.id ?? 'nueva'}
          habits={habits}
          pauses={pauses}
          today={today}
          editing={editing}
          onSubmit={(input) => (editing ? editPause(editing.id, input) : addPause(input))}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {sorted.length === 0 ? (
        <p className="mt-4 text-md text-text-muted">No hay pausas.</p>
      ) : (
        <ul className="mt-4 border-t border-border">
          {sorted.map((pause) => (
            <PauseRow
              key={pause.id}
              pause={pause}
              habits={habits}
              today={today}
              onEdit={() => setEditing(pause)}
              onDelete={() => setToDelete(pause)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="¿Eliminar esta pausa?"
        description={
          toDelete
            ? `${scopeName(toDelete.habitId, habits)}: ${describeRange({ from: toDelete.start, to: toDelete.end }, today).toLowerCase()}. Esos días volverán a contar para las rachas y los porcentajes.`
            : ''
        }
        confirmLabel="Eliminar pausa"
        destructive
        onConfirm={() => {
          if (toDelete) void removePause(toDelete);
        }}
      />
    </section>
  );
}

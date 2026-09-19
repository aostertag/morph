import { useState } from 'react';
import { Link } from 'react-router';
import { restoreEntry, setEntryNote } from '@/db/repos/entries';
import type { LocalDay } from '@/domain/day';
import { canLogOn, type LogPermission } from '@/domain/evaluate';
import type { DayRecord } from '@/domain/history';
import type { Habit } from '@/domain/types';
import { formatDate, formatRelativeDay, formatWeekday } from '@/lib/format';
import { notify, notifyError } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { Field, inputClasses } from '@/ui/Field';
import { describeDayValue } from './describe';

async function saveNote(habit: Habit, day: LocalDay, note: string): Promise<void> {
  try {
    const snapshot = await setEntryNote(habit.id, day, note);
    notify(note.trim() ? 'Nota guardada.' : 'Nota borrada.', {
      key: `note:${habit.id}:${day}`,
      undo: () => restoreEntry(habit.id, day, snapshot),
    });
  } catch (error) {
    notifyError(error);
  }
}

function lockedReason(permission: LogPermission, retroLimitDays: number): string {
  switch (permission) {
    case 'beforeStart':
      return 'Este día es anterior a la creación del hábito.';
    case 'archived':
      return 'El hábito ya estaba archivado ese día.';
    default:
      return `Solo se puede registrar hasta ${retroLimitDays} ${
        retroLimitDays === 1 ? 'día' : 'días'
      } atrás: este día es de solo lectura.`;
  }
}

/**
 * Día seleccionado en el heatmap: qué pasó, su nota y el enlace para registrarlo.
 * La nota se escribe aquí mientras el día esté dentro del límite retroactivo.
 */
export function DayPanel({
  habit,
  record,
  note,
  day,
  today,
  retroLimitDays,
}: {
  habit: Habit;
  record: DayRecord | null;
  /** Nota guardada de ese día. */
  note: string;
  day: LocalDay;
  today: LocalDay;
  retroLimitDays: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const permission = canLogOn(habit, day, today, retroLimitDays);
  const value = draft ?? note;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-medium">
          {formatWeekday(day)} {formatDate(day, today)}
        </h3>
        <p className="text-md text-text-muted">
          {formatRelativeDay(day, today)} · {describeDayValue(habit, record)}
        </p>
      </div>

      {permission === 'ok' ? (
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Nota del día">
            {(props) => (
              <textarea
                {...props}
                rows={2}
                value={value}
                onChange={(event) => setDraft(event.target.value)}
                className={`${inputClasses} resize-y py-2`}
                placeholder="Qué pasó ese día"
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              disabled={value.trim() === note.trim()}
              onClick={() => {
                void saveNote(habit, day, value);
                setDraft(null);
              }}
            >
              Guardar nota
            </Button>
            <Link
              to={`/?dia=${day}`}
              className="text-md text-accent underline-offset-4 hover:underline"
            >
              Registrar en Hoy
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {note && <p className="text-md">{note}</p>}
          <p className="text-sm text-text-muted">{lockedReason(permission, retroLimitDays)}</p>
        </div>
      )}
    </div>
  );
}

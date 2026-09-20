import { useState } from 'react';
import { diffDays, isLocalDay, type LocalDay } from '@/domain/day';
import { type PauseProblem, pauseProblem } from '@/domain/pauses';
import { type Habit, PAUSE_REASONS, type Pause, type PauseReason } from '@/domain/types';
import { describeRange } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';

export const REASON_LABEL: Readonly<Record<PauseReason, string>> = {
  vacaciones: 'Vacaciones',
  enfermedad: 'Enfermedad',
  otro: 'Otro',
};

const GLOBAL = 'todos';

export function scopeName(habitId: string | null, habits: readonly Habit[]): string {
  if (habitId === null) return 'Todos los hábitos';
  return habits.find((h) => h.id === habitId)?.name ?? 'Hábito eliminado';
}

function describeProblem(problem: PauseProblem, today: LocalDay): string {
  if (problem.type === 'range') return problem.message;
  const { with: other } = problem;
  const scope = other.habitId === null ? 'de todos los hábitos' : 'de este hábito';
  return `Se solapa con otra pausa ${scope} (${describeRange({ from: other.start, to: other.end }, today).toLowerCase()}). Acorta una de las dos o edita la existente.`;
}

interface PauseFormProps {
  readonly habits: readonly Habit[];
  readonly pauses: readonly Pause[];
  readonly today: LocalDay;
  /** La pausa que se edita; `null` para crear una nueva. */
  readonly editing: Pause | null;
  readonly onSubmit: (input: Omit<Pause, 'id'>) => Promise<boolean>;
  readonly onCancel: () => void;
}

/**
 * Crear o editar una pausa. Las fechas se validan mientras se escriben con la misma
 * regla que aplica la base de datos: rango invertido y solape con otra pausa del
 * mismo ámbito. Con un problema, "Guardar" queda desactivado y el motivo a la vista.
 */
export function PauseForm({ habits, pauses, today, editing, onSubmit, onCancel }: PauseFormProps) {
  const [scope, setScope] = useState(editing?.habitId ?? GLOBAL);
  const [start, setStart] = useState<string>(editing?.start ?? today);
  const [end, setEnd] = useState<string>(editing?.end ?? today);
  const [reason, setReason] = useState<PauseReason>(editing?.reason ?? 'vacaciones');
  const [note, setNote] = useState(editing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const habitId = scope === GLOBAL ? null : scope;
  const complete = isLocalDay(start) && isLocalDay(end);
  const problem =
    complete && isLocalDay(start) && isLocalDay(end)
      ? pauseProblem({ habitId, start, end }, pauses, editing?.id)
      : null;
  const days =
    complete && isLocalDay(start) && isLocalDay(end) && end >= start
      ? diffDays(start, end) + 1
      : null;

  // Los hábitos archivados no admiten pausas nuevas, salvo el de la pausa que se edita.
  const options = habits.filter((h) => h.archivedOn === null || h.id === editing?.habitId);

  const submit = async () => {
    if (!isLocalDay(start) || !isLocalDay(end) || problem) return;
    setSaving(true);
    const saved = await onSubmit({ habitId, start, end, reason, note: note.trim() || null });
    setSaving(false);
    if (saved) onCancel();
  };

  return (
    <form
      aria-label={editing ? 'Editar pausa' : 'Nueva pausa'}
      className="mt-4 flex flex-col gap-5 border-y border-border py-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label="Se aplica a">
        {(props) => (
          <select
            {...props}
            className={inputClasses}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value={GLOBAL}>Todos los hábitos</option>
            {options.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Desde" error={complete ? undefined : 'Indica la fecha.'}>
          {(props) => (
            <input
              {...props}
              type="date"
              className={inputClasses}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Hasta"
          description={
            days === null ? undefined : `${days} ${days === 1 ? 'día' : 'días'}, ambos incluidos.`
          }
        >
          {(props) => (
            <input
              {...props}
              type="date"
              min={isLocalDay(start) ? start : undefined}
              className={inputClasses}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              aria-invalid={problem ? true : props['aria-invalid']}
            />
          )}
        </Field>
      </div>

      {problem && (
        <p role="alert" className="-mt-2 text-sm text-danger">
          {describeProblem(problem, today)}
        </p>
      )}

      <Fieldset legend="Motivo">
        <Segmented
          name="motivo-pausa"
          options={PAUSE_REASONS.map((value) => ({ value, label: REASON_LABEL[value] }))}
          value={reason}
          onChange={setReason}
        />
      </Fieldset>

      <Field label="Nota (opcional)">
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={200}
            className={inputClasses}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={!complete || problem !== null || saving}>
          {editing ? 'Guardar cambios' : 'Crear pausa'}
        </Button>
      </div>
    </form>
  );
}

import { type FormEvent, useState } from 'react';
import { addDays, isLocalDay, type LocalDay, type Weekday } from '@/domain/day';
import { type HabitInput, startDateRange, validateHabitInput } from '@/domain/habit';
import { buildDayView } from '@/domain/today';
import type { Category, HabitKind, TimeOfDay } from '@/domain/types';
import { HabitRow } from '@/features/today/HabitRow';
import { formatDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { CategoryField, ColorField, FrequencyField, IconField, ReminderField } from './fields';

const KIND_HELP: Record<HabitKind, string> = {
  boolean: 'Se marca como hecho o no.',
  quantity: 'Tiene una meta numérica; se guarda lo que hagas aunque la superes.',
  time: 'Se mide en minutos, con cronómetro opcional.',
  avoid: 'Algo que quieres dejar. Cada día sin registrarlo es un día limpio.',
};

function startDescription(
  mode: 'create' | 'edit',
  retroLimitDays: number,
  firstEntry: LocalDay | null,
  min: LocalDay,
  max: LocalDay,
  today: LocalDay,
): string | undefined {
  if (mode === 'create') {
    return retroLimitDays > 0
      ? `Puedes empezar hasta ${retroLimitDays} ${retroLimitDays === 1 ? 'día' : 'días'} atrás para registrar días anteriores.`
      : undefined;
  }
  if (min === max) {
    return firstEntry
      ? `Ya hay un registro el ${formatDate(firstEntry, today)}, así que la fecha no se puede mover.`
      : 'La fecha no se puede mover.';
  }
  const limit = `Puedes adelantarla hasta el ${formatDate(min, today)}`;
  return firstEntry
    ? `${limit}. No puede pasar de tu primer registro (${formatDate(firstEntry, today)}).`
    : `${limit}, según el límite para registrar días anteriores.`;
}

interface HabitFormProps {
  readonly mode: 'create' | 'edit';
  readonly initial: HabitInput;
  readonly today: LocalDay;
  readonly weekStartsOn: Weekday;
  readonly retroLimitDays: number;
  /** Fecha del primer registro (solo al editar): el inicio no puede pasar de ahí. */
  readonly firstEntry?: LocalDay | null;
  readonly categories: readonly Category[];
  readonly onSubmit: (input: HabitInput) => Promise<void>;
  readonly onCancel: () => void;
}

export function HabitForm({
  mode,
  initial,
  today,
  weekStartsOn,
  retroLimitDays,
  firstEntry = null,
  categories,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [draft, setDraft] = useState<HabitInput>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errors = showErrors ? validateHabitInput(draft) : {};
  const update = (patch: Partial<HabitInput>) => setDraft((current) => ({ ...current, ...patch }));

  const setKind = (kind: HabitKind) => {
    const periodic = draft.frequency.type === 'perWeek' || draft.frequency.type === 'perMonth';
    update({
      kind,
      target:
        kind === 'time'
          ? draft.kind === 'time'
            ? draft.target
            : 15
          : kind === 'quantity'
            ? draft.target
            : null,
      unit: kind === 'quantity' ? draft.unit : null,
      frequency: kind === 'avoid' && periodic ? { type: 'daily' } : draft.frequency,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    const found = validateHabitInput(draft);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(draft);
    } finally {
      setSubmitting(false);
    }
  };

  const startRange =
    mode === 'create'
      ? { min: addDays(today, -retroLimitDays), max: today }
      : startDateRange(today, retroLimitDays, initial.createdOn, firstEntry);
  const preview = buildDayView(
    { ...draft, id: 'vista-previa', order: 0, archivedOn: null, createdOn: today },
    [],
    { today, weekStartsOn, pauses: [] },
    today,
  );

  return (
    <form
      noValidate
      onSubmit={submit}
      className="grid gap-12 lg:grid-cols-[minmax(0,var(--container-list))_var(--container-panel)] lg:justify-between"
    >
      <div className="min-w-0 space-y-8">
        <Field label="Nombre" error={errors.name}>
          {(props) => (
            <input
              {...props}
              value={draft.name}
              maxLength={60}
              autoComplete="off"
              placeholder="Leer, beber agua, caminar…"
              onChange={(e) => update({ name: e.target.value })}
              className={inputClasses}
            />
          )}
        </Field>

        <Fieldset legend="Tipo" description={KIND_HELP[draft.kind]}>
          <Segmented
            name="kind"
            wrap
            value={draft.kind}
            onChange={setKind}
            options={[
              { value: 'boolean', label: 'Sí / no' },
              { value: 'quantity', label: 'Cantidad' },
              { value: 'time', label: 'Tiempo' },
              { value: 'avoid', label: 'A evitar' },
            ]}
          />
        </Fieldset>

        {draft.kind === 'quantity' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Meta diaria" error={errors.target}>
              {(props) => (
                <input
                  {...props}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.target ?? ''}
                  onChange={(e) =>
                    update({ target: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className={inputClasses}
                />
              )}
            </Field>
            <Field label="Unidad" error={errors.unit}>
              {(props) => (
                <input
                  {...props}
                  value={draft.unit ?? ''}
                  maxLength={20}
                  placeholder="vasos, pasos…"
                  onChange={(e) => update({ unit: e.target.value })}
                  className={inputClasses}
                />
              )}
            </Field>
          </div>
        )}

        {draft.kind === 'time' && (
          <Field label="Meta diaria en minutos" error={errors.target} className="max-w-60">
            {(props) => (
              <input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.target ?? ''}
                onChange={(e) =>
                  update({ target: e.target.value === '' ? null : Number(e.target.value) })
                }
                className={inputClasses}
              />
            )}
          </Field>
        )}

        <FrequencyField
          value={draft.frequency}
          kind={draft.kind}
          weekStartsOn={weekStartsOn}
          error={errors.frequency}
          onChange={(frequency) => update({ frequency })}
        />

        <Fieldset legend="Momento del día" description="Agrupa los hábitos en la pantalla Hoy.">
          <Segmented<TimeOfDay>
            name="timeOfDay"
            wrap
            value={draft.timeOfDay}
            onChange={(timeOfDay) => update({ timeOfDay })}
            options={[
              { value: 'morning', label: 'Mañana' },
              { value: 'afternoon', label: 'Tarde' },
              { value: 'evening', label: 'Noche' },
              { value: 'any', label: 'Cualquiera' },
            ]}
          />
        </Fieldset>

        {draft.kind !== 'avoid' && (
          <ReminderField
            value={draft.reminder}
            error={errors.reminder}
            onChange={(reminder) => update({ reminder })}
          />
        )}

        <ColorField value={draft.color} onChange={(color) => update({ color })} />
        <IconField value={draft.icon} onChange={(icon) => update({ icon })} />
        <CategoryField
          value={draft.categoryId}
          categories={categories}
          onChange={(categoryId) => update({ categoryId })}
        />

        <Field label="Descripción" description="Opcional." error={errors.description}>
          {(props) => (
            <textarea
              {...props}
              value={draft.description}
              maxLength={280}
              rows={3}
              onChange={(e) => update({ description: e.target.value })}
              className={`${inputClasses} py-2`}
            />
          )}
        </Field>

        <Field
          label="Empieza el"
          className="max-w-60"
          description={startDescription(
            mode,
            retroLimitDays,
            firstEntry,
            startRange.min,
            startRange.max,
            today,
          )}
        >
          {(props) => (
            <input
              {...props}
              type="date"
              min={startRange.min}
              max={startRange.max}
              value={draft.createdOn}
              onChange={(e) => {
                const value = e.target.value;
                if (isLocalDay(value) && value >= startRange.min && value <= startRange.max)
                  update({ createdOn: value });
              }}
              className={inputClasses}
            />
          )}
        </Field>

        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          <Button type="submit" variant="primary" disabled={submitting}>
            {mode === 'create' ? 'Crear hábito' : 'Guardar cambios'}
          </Button>
          <Button onClick={onCancel}>Cancelar</Button>
        </div>
      </div>

      <aside aria-label="Vista previa" className="order-first lg:order-none">
        <div className="lg:sticky lg:top-8">
          <h2 className="label-caps mb-2">Vista previa</h2>
          <ul className="border-t border-border" aria-hidden="true">
            <HabitRow view={preview} today={today} locked={false} preview />
          </ul>
        </div>
      </aside>
    </form>
  );
}

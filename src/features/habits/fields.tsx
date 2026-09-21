import { CircleSlash } from 'lucide-react';
import { useState } from 'react';
import { createCategory } from '@/db/repos/categories';
import { CATEGORY_NAME_MAX, categoryNameProblem } from '@/domain/categories';
import type { Weekday } from '@/domain/day';
import type { Category, Frequency, HabitColor, HabitKind, Reminder } from '@/domain/types';
import { cx } from '@/lib/cx';
import { orderedWeekdays, weekdayLetter, weekdayLong } from '@/lib/format';
import { notifyError } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { HABIT_COLOR_DISPLAY_ORDER, HABIT_COLOR_LABEL, habitColorVar } from '@/ui/HabitMarks';
import { HABIT_ICON_NAMES, HABIT_ICONS } from '@/ui/icons';
import { Segmented } from '@/ui/Segmented';

/* Campos compuestos del formulario de hábito. */

type FrequencyType = Frequency['type'];

const FREQUENCY_DEFAULTS: Record<FrequencyType, Frequency> = {
  daily: { type: 'daily' },
  weekdays: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
  perWeek: { type: 'perWeek', times: 3 },
  perMonth: { type: 'perMonth', times: 10 },
};

export function FrequencyField({
  value,
  kind,
  weekStartsOn,
  error,
  onChange,
}: {
  value: Frequency;
  kind: HabitKind;
  weekStartsOn: Weekday;
  error: string | undefined;
  onChange: (frequency: Frequency) => void;
}) {
  const periodDisabled = kind === 'avoid';
  return (
    <Fieldset
      legend="Frecuencia"
      error={error}
      description={
        periodDisabled
          ? 'Los hábitos a evitar se cuentan día a día.'
          : value.type === 'perWeek' || value.type === 'perMonth'
            ? 'Cualquier día vale: no hacerlo un día concreto no rompe la racha.'
            : undefined
      }
    >
      <Segmented
        name="frequency"
        wrap
        value={value.type}
        onChange={(type) => onChange(FREQUENCY_DEFAULTS[type])}
        options={[
          { value: 'daily', label: 'Diaria' },
          { value: 'weekdays', label: 'Días concretos' },
          { value: 'perWeek', label: 'Por semana', disabled: periodDisabled },
          { value: 'perMonth', label: 'Por mes', disabled: periodDisabled },
        ]}
      />

      {value.type === 'weekdays' && (
        <fieldset className="mt-2 flex flex-wrap gap-1">
          <legend className="sr-only">Días de la semana</legend>
          {orderedWeekdays(weekStartsOn).map((day) => {
            const on = value.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={weekdayLong(day)}
                onClick={() =>
                  onChange({
                    type: 'weekdays',
                    days: on ? value.days.filter((d) => d !== day) : [...value.days, day].sort(),
                  })
                }
                className={cx(
                  'pressable size-touch rounded-md border text-md transition-colors duration-(--duration-fast)',
                  on
                    ? 'border-text bg-text font-medium text-bg'
                    : 'border-border-strong hover:bg-sunken',
                )}
              >
                {weekdayLetter(day)}
              </button>
            );
          })}
        </fieldset>
      )}

      {(value.type === 'perWeek' || value.type === 'perMonth') && (
        <Field
          label={value.type === 'perWeek' ? 'Veces por semana' : 'Veces al mes'}
          className="mt-2 max-w-40"
        >
          {(props) => (
            <input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              max={value.type === 'perWeek' ? 7 : 28}
              value={value.times}
              onChange={(e) => onChange({ type: value.type, times: Number(e.target.value) })}
              className={inputClasses}
            />
          )}
        </Field>
      )}
    </Fieldset>
  );
}

export function ColorField({
  value,
  onChange,
}: {
  value: HabitColor;
  onChange: (color: HabitColor) => void;
}) {
  return (
    <Fieldset legend="Color">
      <div className="flex flex-wrap">
        {HABIT_COLOR_DISPLAY_ORDER.map((color) => (
          <label
            key={color}
            className="group flex size-touch cursor-pointer items-center justify-center rounded-md hover:bg-sunken has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="color"
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="sr-only"
            />
            <span className="sr-only">{HABIT_COLOR_LABEL[color]}</span>
            <span
              aria-hidden="true"
              className="size-7 rounded-sm outline-offset-2 group-has-checked:outline-2 group-has-checked:outline-text"
              style={{ backgroundColor: habitColorVar(color) }}
            />
          </label>
        ))}
      </div>
    </Fieldset>
  );
}

export function IconField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  const options: (string | null)[] = [null, ...HABIT_ICON_NAMES];
  return (
    <Fieldset legend="Icono" description="Opcional.">
      <div className="flex flex-wrap gap-1">
        {options.map((name) => {
          const entry = name ? HABIT_ICONS[name] : undefined;
          // «Ninguno» es un icono más (círculo tachado): mismo tamaño y mismo estado elegido.
          const Icon = entry?.icon ?? CircleSlash;
          const label = entry?.label ?? 'Ninguno';
          return (
            <label
              key={name ?? 'ninguno'}
              title={label}
              className={cx(
                'flex size-touch cursor-pointer items-center justify-center rounded-md border border-transparent text-text-muted',
                'hover:bg-sunken has-checked:border-text has-checked:text-text',
                'has-focus-visible:outline-2 has-focus-visible:outline-accent',
              )}
            >
              <input
                type="radio"
                name="icon"
                checked={value === name}
                onChange={() => onChange(name)}
                className="sr-only"
              />
              <Icon size={18} aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </label>
          );
        })}
      </div>
    </Fieldset>
  );
}

const NEW_CATEGORY = '__nueva__';

export function CategoryField({
  value,
  categories,
  onChange,
}: {
  value: string | null;
  categories: readonly Category[];
  onChange: (categoryId: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const nameProblem = categoryNameProblem(name, categories);

  const add = async () => {
    if (nameProblem) return;
    try {
      const category = await createCategory(name);
      onChange(category.id);
      setCreating(false);
      setName('');
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="Categoría" description="Opcional. Sirve para agrupar en las estadísticas.">
        {(props) => (
          <select
            {...props}
            value={creating ? NEW_CATEGORY : (value ?? '')}
            onChange={(e) => {
              if (e.target.value === NEW_CATEGORY) {
                setCreating(true);
                return;
              }
              setCreating(false);
              onChange(e.target.value || null);
            }}
            className={inputClasses}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>Nueva categoría…</option>
          </select>
        )}
      </Field>
      {creating && (
        <div className="flex items-end gap-2">
          <Field
            label="Nombre de la categoría"
            error={name.trim() ? nameProblem?.message : undefined}
            className="flex-1"
          >
            {(props) => (
              <input
                {...props}
                value={name}
                maxLength={CATEGORY_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void add();
                  }
                }}
                className={inputClasses}
              />
            )}
          </Field>
          <Button onClick={() => void add()} disabled={nameProblem !== null}>
            Añadir
          </Button>
        </div>
      )}
    </div>
  );
}

const DEFAULT_REMINDER_TIME = '09:00';

/** Recordatorio diario con hora: se avisa solo si ese día el hábito sigue pendiente. */
export function ReminderField({
  value,
  error,
  onChange,
}: {
  value: Reminder | null;
  error?: string | undefined;
  onChange: (value: Reminder | null) => void;
}) {
  const enabled = value?.enabled ?? false;
  const time = value?.time ?? DEFAULT_REMINDER_TIME;
  return (
    <Fieldset
      legend="Recordatorio"
      description="Una notificación a esa hora si el hábito toca y sigue pendiente. Solo sale con la app abierta; el permiso se da en Ajustes."
      error={error}
    >
      <Segmented<'off' | 'on'>
        name="recordatorio"
        className="max-w-xs"
        value={enabled ? 'on' : 'off'}
        onChange={(next) =>
          onChange(next === 'on' ? { time, enabled: true } : value && { ...value, enabled: false })
        }
        options={[
          { value: 'off', label: 'Sin aviso' },
          { value: 'on', label: 'Con aviso' },
        ]}
      />
      {enabled && (
        <Field label="Hora del aviso" className="mt-3 max-w-40" error={error}>
          {(props) => (
            <input
              {...props}
              type="time"
              value={time}
              className={inputClasses}
              onChange={(event) => onChange({ time: event.target.value, enabled: true })}
            />
          )}
        </Field>
      )}
    </Fieldset>
  );
}

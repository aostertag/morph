import { useState } from 'react';
import type { LocalDay } from '@/domain/day';
import type { DayLog, Scale } from '@/domain/types';
import { cx } from '@/lib/cx';
import { ENERGY_LABEL, MOOD_LABEL } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { setDayNote, setEnergy, setMood } from './dayLogActions';

const SCALES: readonly Scale[] = [1, 2, 3, 4, 5];

/**
 * Escala de 1 a 5 con radios nativos: se recorre con las flechas y el lector de
 * pantalla lee el número y su significado ("3, normal").
 */
function ScaleField({
  legend,
  name,
  labels,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  labels: Readonly<Record<Scale, string>>;
  value: Scale | null;
  onChange: (value: Scale | null) => void;
}) {
  return (
    <Fieldset legend={legend}>
      <div className="flex items-center gap-2">
        <div className="grid flex-1 auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-border-strong">
          {SCALES.map((step) => (
            <label
              key={step}
              className={cx(
                'flex min-h-touch cursor-pointer items-center justify-center border-border-strong text-md not-first:border-l',
                'transition-colors duration-(--duration-fast)',
                'has-checked:bg-text has-checked:font-medium has-checked:text-bg',
                'has-focus-visible:relative has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-accent',
                'hover:not-has-checked:bg-sunken',
              )}
            >
              <input
                type="radio"
                name={name}
                value={step}
                checked={value === step}
                onChange={() => onChange(step)}
                className="sr-only"
              />
              <span aria-hidden="true">{step}</span>
              <span className="sr-only">
                {step}, {labels[step].toLowerCase()}
              </span>
            </label>
          ))}
        </div>
        <Button
          variant="ghost"
          className="px-2 text-sm text-text-muted"
          disabled={value === null}
          onClick={() => onChange(null)}
        >
          Quitar
        </Button>
      </div>
      <p className="min-h-5 text-sm text-text-muted">{value === null ? '' : labels[value]}</p>
    </Fieldset>
  );
}

/**
 * Registro rápido del día: ánimo, energía y una nota. De aquí salen las
 * correlaciones de las estadísticas, así que se pide poco y se pide claro.
 */
export function DayLogPanel({
  day,
  today,
  log,
  locked,
}: {
  day: LocalDay;
  today: LocalDay;
  log: DayLog | undefined;
  /** El día queda fuera del límite retroactivo: solo lectura. */
  locked: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const note = log?.note ?? '';
  const value = draft ?? note;

  if (locked) {
    if (log === undefined) return null;
    return (
      <section aria-labelledby="dia-registro" className="mt-10">
        <h2 id="dia-registro" className="label-caps border-b border-border pb-2">
          Cómo fue el día
        </h2>
        <p className="mt-3 text-md text-text-muted">
          {log.mood !== null && `Ánimo: ${MOOD_LABEL[log.mood].toLowerCase()}. `}
          {log.energy !== null && `Energía: ${ENERGY_LABEL[log.energy].toLowerCase()}.`}
        </p>
        {log.note && <p className="mt-2 text-md">{log.note}</p>}
      </section>
    );
  }

  return (
    <section aria-labelledby="dia-registro" className="mt-10">
      <h2 id="dia-registro" className="label-caps border-b border-border pb-2">
        Cómo fue el día
      </h2>
      <div className="mt-4 flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ScaleField
            legend="Ánimo"
            name="animo"
            labels={MOOD_LABEL}
            value={log?.mood ?? null}
            onChange={(next) => void setMood(day, today, next)}
          />
          <ScaleField
            legend="Energía"
            name="energia"
            labels={ENERGY_LABEL}
            value={log?.energy ?? null}
            onChange={(next) => void setEnergy(day, today, next)}
          />
        </div>

        <Field label="Nota del día">
          {(props) => (
            <textarea
              {...props}
              rows={2}
              value={value}
              onChange={(event) => setDraft(event.target.value)}
              className={`${inputClasses} resize-y py-2`}
              placeholder="Qué ha pasado hoy"
            />
          )}
        </Field>
        <div>
          <Button
            disabled={value.trim() === note.trim()}
            onClick={() => {
              void setDayNote(day, today, value);
              setDraft(null);
            }}
          >
            Guardar nota
          </Button>
        </div>
      </div>
    </section>
  );
}

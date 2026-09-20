import { useState } from 'react';
import type { LocalDay } from '@/domain/day';
import type { WeeklyReview } from '@/domain/types';
import { Button } from '@/ui/Button';
import { Field, inputClasses } from '@/ui/Field';
import { saveReview } from './reviewActions';

/**
 * La reflexión de la semana. Se puede escribir y corregir siempre: no es un
 * registro del día, sino una nota sobre algo que ya pasó, así que el límite
 * retroactivo no pinta nada aquí.
 */
export function ReflectionForm({
  weekStart,
  review,
}: {
  weekStart: LocalDay;
  review: WeeklyReview | null;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const saved = review?.reflection ?? '';
  const value = draft ?? saved;

  return (
    <section aria-labelledby="reflexion" className="mt-12">
      <h2 id="reflexion" className="label-caps mb-3 border-b border-border pb-2">
        Reflexión
      </h2>
      <div className="flex flex-col gap-4">
        <Field label="Qué te llevas de la semana">
          {(props) => (
            <textarea
              {...props}
              rows={4}
              value={value}
              onChange={(event) => setDraft(event.target.value)}
              className={`${inputClasses} resize-y py-2`}
              placeholder="Qué funcionó, qué estorbó y qué cambiarías"
            />
          )}
        </Field>
        <div>
          <Button
            disabled={value.trim() === saved.trim()}
            onClick={() => {
              void saveReview(weekStart, value);
              setDraft(null);
            }}
          >
            Guardar reflexión
          </Button>
        </div>
      </div>
    </section>
  );
}

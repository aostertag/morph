import { useState } from 'react';
import { updateSettings } from '@/db/repos/settings';
import { DevToolsFooter } from '@/dev/DevTools';
import type { Weekday } from '@/domain/day';
import type { Settings, ThemePreference } from '@/domain/types';
import { useHabits, usePauses, useSettings } from '@/hooks/useData';
import { weekdayLong } from '@/lib/format';
import { notifyError } from '@/lib/toast';
import { ScreenHeader } from '@/ui/EmptyState';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { DataSection } from './DataSection';
import { PausesSection } from './PausesSection';
import { RemindersSection } from './RemindersSection';

const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

const RETRO_MAX = 365;

/** Los cambios de ajustes se aplican al momento: no hay botón de guardar. */
function save(patch: Partial<Settings>): void {
  updateSettings(patch).catch(notifyError);
}

function RetroLimit({ value }: { value: number }) {
  const [text, setText] = useState(String(value));
  const parsed = /^\d{1,3}$/.test(text.trim()) ? Number(text) : Number.NaN;
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= RETRO_MAX;

  return (
    <Field
      label="Registrar días anteriores"
      description="Cuántos días hacia atrás se puede registrar o corregir. Con 0 solo se registra hoy. Más allá de ese límite un día es de solo lectura."
      error={valid ? undefined : `Escribe un número entero entre 0 y ${RETRO_MAX}.`}
      className="max-w-sm"
    >
      {(props) => (
        <div className="flex items-center gap-3">
          <input
            {...props}
            type="text"
            inputMode="numeric"
            className={`${inputClasses} w-24`}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              const next = /^\d{1,3}$/.test(event.target.value.trim())
                ? Number(event.target.value)
                : Number.NaN;
              if (Number.isInteger(next) && next >= 0 && next <= RETRO_MAX) {
                save({ retroLimitDays: next });
              }
            }}
            onBlur={() => {
              if (!valid) setText(String(value));
            }}
          />
          <span className="text-md text-text-muted">días atrás</span>
        </div>
      )}
    </Field>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const habits = useHabits();
  const pauses = usePauses();

  if (!settings || !habits || !pauses) return null;

  return (
    <div className="max-w-list">
      <ScreenHeader title="Ajustes" />

      <section aria-labelledby="apariencia">
        <h2 id="apariencia" className="label-caps border-b border-border pb-2">
          Apariencia
        </h2>
        <div className="mt-4 max-w-sm">
          <Fieldset legend="Tema">
            <Segmented
              name="tema"
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(theme) => save({ theme })}
            />
          </Fieldset>
        </div>
      </section>

      <section aria-labelledby="calendario" className="mt-12">
        <h2 id="calendario" className="label-caps border-b border-border pb-2">
          Calendario
        </h2>
        <div className="mt-4 flex flex-col gap-6">
          <Field
            label="La semana empieza el"
            description="Afecta a las semanas de las estadísticas, las metas semanales y la revisión."
            className="max-w-sm"
          >
            {(props) => (
              <select
                {...props}
                className={inputClasses}
                value={settings.weekStartsOn}
                onChange={(event) => save({ weekStartsOn: Number(event.target.value) as Weekday })}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <option key={day} value={day}>
                    {weekdayLong(day as Weekday)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <RetroLimit value={settings.retroLimitDays} />
        </div>
      </section>

      <RemindersSection habits={habits} />
      <PausesSection pauses={pauses} habits={habits} />
      <DataSection />
      <DevToolsFooter />
    </div>
  );
}

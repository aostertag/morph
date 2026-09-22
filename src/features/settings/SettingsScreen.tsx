import { useState } from 'react';
import { updateSettings } from '@/db/repos/settings';
import { DevToolsFooter } from '@/dev/DevTools';
import type { Weekday } from '@/domain/day';
import type { Settings, ThemePreference } from '@/domain/types';
import { useCategories, useHabits, usePauses, useSettings } from '@/hooks/useData';
import { weekdayLong } from '@/lib/format';
import { notifyError } from '@/lib/toast';
import { useShortcutsDialog } from '@/state/shortcutsDialog';
import { Button } from '@/ui/Button';
import { Field, Fieldset, inputClasses } from '@/ui/Field';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Segmented } from '@/ui/Segmented';
import { version } from '../../../package.json';
import { CategoriesSection } from './CategoriesSection';
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

/** Devuelve el número escrito si está dentro del rango; si no, `null`. */
function parseRetroLimit(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= 0 && parsed <= RETRO_MAX ? parsed : null;
}

function RetroLimit({ value }: { value: number }) {
  const [text, setText] = useState(String(value));
  const [saved, setSaved] = useState(value);
  // Lo que se acaba de mandar a guardar y aún no ha vuelto de la base.
  const [pending, setPending] = useState<number | null>(null);
  // Si el valor cambia por fuera (importar una copia, borrar todo, deshacer), el campo lo refleja.
  // El eco de un guardado propio no: si se sigue escribiendo mientras llega, pisaría lo escrito.
  if (saved !== value) {
    setSaved(value);
    if (pending === null) setText(String(value));
    else if (value === pending) setPending(null);
  }

  const parsed = parseRetroLimit(text);

  /** Se guarda al terminar de escribir, no en cada tecla: «14» pasaría por «1». */
  const commit = () => {
    if (parsed === null) {
      setText(String(value));
      return;
    }
    if (parsed === value) return;
    setPending(parsed);
    updateSettings({ retroLimitDays: parsed }).catch((error: unknown) => {
      setPending(null);
      notifyError(error);
    });
  };

  return (
    <Field
      label="Registrar días anteriores"
      description="Cuántos días hacia atrás se puede registrar o corregir. Con 0 solo se registra hoy. Más allá de ese límite un día es de solo lectura."
      error={parsed === null ? `Escribe un número entero entre 0 y ${RETRO_MAX}.` : undefined}
      className="max-w-sm"
    >
      {(props) => (
        <div className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <input
              {...props}
              type="text"
              inputMode="numeric"
              className={inputClasses}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commit();
                }
              }}
            />
          </div>
          <span className="whitespace-nowrap text-md text-text-muted">días atrás</span>
        </div>
      )}
    </Field>
  );
}

export function SettingsScreen() {
  const settings = useSettings();
  const habits = useHabits();
  const pauses = usePauses();
  const categories = useCategories();

  if (!settings || !habits || !pauses || !categories) return null;

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

      <section aria-labelledby="teclado" className="mt-12">
        <h2 id="teclado" className="label-caps border-b border-border pb-2">
          Teclado
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-prose text-md text-text-muted">
            En escritorio, los números marcan hábitos, las flechas cambian de día y N crea uno
            nuevo. Con ? se abre la lista completa desde cualquier pantalla.
          </p>
          <Button onClick={() => useShortcutsDialog.getState().setOpen(true)}>Ver atajos</Button>
        </div>
      </section>

      <RemindersSection habits={habits} />
      <CategoriesSection categories={categories} habits={habits} />
      <PausesSection pauses={pauses} habits={habits} />
      <DataSection />
      <DevToolsFooter />

      <footer className="mt-16 text-sm text-text-muted">
        <p>Hecho por Agustín Ostertag</p>
        <p>Versión {version}</p>
      </footer>
    </div>
  );
}

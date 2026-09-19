import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { HABIT_COLORS, type ThemePreference } from '@/domain/types';
import type { ResolvedTheme } from '@/lib/theme';

/**
 * Página de comprobación de la Fase 1: muestra los tokens aplicados en el tema
 * activo para validar paleta y tipografía en pantalla. Se sustituye en la Fase 2.
 */

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

const NEUTRALS = [
  ['bg', 'Fondo'],
  ['surface', 'Superficie'],
  ['sunken', 'Hundido'],
  ['border', 'Separador'],
  ['border-strong', 'Borde de control'],
  ['text', 'Texto'],
  ['text-muted', 'Texto secundario'],
  ['text-faint', 'Metadatos y ejes'],
  ['accent', 'Acento'],
  ['danger', 'Error'],
] as const;

const TYPE_SCALE = [
  ['text-4xl', '56 / 60'],
  ['text-3xl', '40 / 44'],
  ['text-2xl', '28 / 34'],
  ['text-xl', '22 / 28'],
  ['text-lg', '18 / 26'],
  ['text-base', '16 / 24'],
  ['text-md', '14 / 20'],
  ['text-sm', '13 / 18'],
  ['text-xs', '12 / 16'],
] as const;

const number = new Intl.NumberFormat('es-ES');
const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 });

function tokenValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-4 pb-10">
      <h2 className="label-caps mb-6">{title}</h2>
      {children}
    </section>
  );
}

interface Props {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  onPreferenceChange: (preference: ThemePreference) => void;
}

export function TokenSpecimen({ preference, resolved, onPreferenceChange }: Props) {
  return (
    <main className="mx-auto max-w-list px-gutter py-8 lg:px-gutter-desktop">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label-caps">Fase 1 · Tokens de diseño</p>
          <h1 className="mt-1 text-xl font-semibold">Hábitos</h1>
          <p className="mt-1 text-md text-text-muted">
            Tema aplicado: {resolved === 'dark' ? 'oscuro' : 'claro'}.
          </p>
        </div>
        <fieldset className="flex rounded-md border border-border-strong">
          <legend className="sr-only">Tema</legend>
          {THEMES.map((theme) => (
            <label
              key={theme.value}
              className="flex min-h-touch cursor-pointer items-center px-4 text-md has-checked:bg-text has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="theme"
                value={theme.value}
                checked={preference === theme.value}
                onChange={() => onPreferenceChange(theme.value)}
                className="sr-only"
              />
              {theme.label}
            </label>
          ))}
        </fieldset>
      </header>

      <Section title="Cifras">
        <div className="flex items-end justify-between gap-6">
          <p className="text-4xl font-semibold">{percent.format(0.57)}</p>
          <p className="text-right text-md text-text-muted">
            <span className="block text-lg font-medium text-text">4 de 7</span>
            hábitos programados
          </p>
        </div>
        <div className="mt-3 flex h-1 gap-0.5" aria-hidden="true">
          {(['azul', 'verde', 'ocre', 'violeta', null, null, null] as const).map((color, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: segmentos fijos de demostración
              key={i}
              className="flex-1"
              style={{
                backgroundColor: color ? `var(--color-habit-${color})` : 'var(--color-sunken)',
              }}
            />
          ))}
        </div>
        <table className="mt-8 w-full text-md">
          <caption className="sr-only">Cifras de ejemplo alineadas</caption>
          <tbody>
            {[
              ['Racha actual', '12 d'],
              ['Mejor racha', '148 d'],
              ['Cumplimiento 7 días', percent.format(0.86)],
              ['Cumplimiento 30 días', percent.format(0.714)],
              ['Total de registros', number.format(1204)],
              ['Ánimo medio', number.format(4.1)],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-border">
                <th scope="row" className="py-2 text-left font-normal text-text-muted">
                  {label}
                </th>
                <td className="py-2 text-right font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Escala tipográfica · IBM Plex Sans">
        <ul className="space-y-3">
          {TYPE_SCALE.map(([size, metrics]) => (
            <li key={size} className="flex items-baseline gap-4">
              <span className="w-14 shrink-0 text-xs text-text-faint">{metrics}</span>
              <span className={`${size} truncate`}>Leer 20 páginas</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Neutros, acento y error">
        <ul>
          {NEUTRALS.map(([token, label]) => (
            <li key={token} className="flex items-center gap-4 border-b border-border py-2">
              <span
                className="size-6 shrink-0 rounded-sm border border-border-strong"
                style={{ backgroundColor: `var(--color-${token})` }}
              />
              <span className="flex-1 text-md">{label}</span>
              <code className="text-sm text-text-muted">{tokenValue(token)}</code>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="pressable min-h-touch rounded-md bg-accent px-4 font-medium text-on-accent"
          >
            Guardar hábito
          </button>
          <button
            type="button"
            className="pressable min-h-touch rounded-md border border-border-strong px-4 font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pressable min-h-touch rounded-md px-4 font-medium text-danger"
          >
            Eliminar
          </button>
        </div>
      </Section>

      <Section title="Escala del heatmap">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="size-4 rounded-sm"
              style={{ backgroundColor: `var(--color-heat-${level})` }}
            />
          ))}
          <span>Más</span>
        </div>
      </Section>

      <Section title="Paleta de hábitos">
        <ul>
          {HABIT_COLORS.map((color, i) => (
            <li key={color} className="flex min-h-14 items-center gap-3 border-b border-border">
              <span
                className="w-0.75 self-stretch"
                style={{ backgroundColor: `var(--color-habit-${color})` }}
              />
              <span className="flex-1 py-2">
                <span className="block capitalize">{color}</span>
                <code className="text-sm text-text-muted">{tokenValue(`habit-${color}`)}</code>
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: `var(--color-habit-${color})` }}
              >
                {number.format(8 + i)}/10
              </span>
              <span className="flex size-touch items-center justify-center">
                <span
                  className="flex size-7 items-center justify-center rounded-sm text-on-habit"
                  style={{ backgroundColor: `var(--color-habit-${color})` }}
                >
                  <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

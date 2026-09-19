import type { ReactNode } from 'react';
import { DataTable } from '@/charts/ChartFigure';
import type { HabitHistory } from '@/domain/history';
import {
  type AvoidStats,
  avoidStats,
  RATE_WINDOWS,
  type Rate,
  rateWindows,
  totals,
} from '@/domain/metrics';
import type { StreakSummary } from '@/domain/streaks';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatStreak,
} from '@/lib/format';

function Figure({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1">
        <span className="block text-3xl font-semibold">{value}</span>
        {note && <span className="mt-0.5 block text-sm text-text-muted">{note}</span>}
      </dd>
    </div>
  );
}

function bestNote(streak: StreakSummary, history: HabitHistory): string | undefined {
  const range = streak.bestRange;
  if (!range) return undefined;
  return `Hasta el ${formatDate(range.end, history.today)}`;
}

/** Las cifras que mandan: racha, mejor racha, comodines y total. */
export function Figures({ history, streak }: { history: HabitHistory; streak: StreakSummary }) {
  const { habit } = history;
  const counts = totals(history);
  const unitLabel = streak.unit === 'day' ? 'días' : streak.unit === 'week' ? 'semanas' : 'meses';

  if (habit.kind === 'avoid') {
    const stats: AvoidStats = avoidStats(history);
    return (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border py-6 sm:grid-cols-4">
        <Figure
          label="Sin recaer"
          value={formatStreak(streak.current, 'day')}
          note={
            stats.lastRelapse
              ? `Última recaída el ${formatShortDate(stats.lastRelapse)}`
              : 'Ninguna recaída'
          }
        />
        <Figure
          label="Mejor racha"
          value={formatStreak(streak.best, 'day')}
          note={bestNote(streak, history)}
        />
        <Figure
          label="Recaídas (30 días)"
          value={formatNumber(stats.relapsesLast30)}
          note={`${formatNumber(stats.relapses)} en total`}
        />
        <Figure
          label="Días limpios"
          value={formatNumber(stats.cleanDays)}
          note={
            stats.averageGap === null
              ? undefined
              : `Una recaída cada ${formatNumber(stats.averageGap)} días`
          }
        />
      </dl>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border py-6 sm:grid-cols-4">
      <Figure
        label="Racha actual"
        value={formatStreak(streak.current, streak.unit)}
        note={streak.current === 0 ? 'Sin racha' : undefined}
      />
      <Figure
        label="Mejor racha"
        value={formatStreak(streak.best, streak.unit)}
        note={bestNote(streak, history)}
      />
      <Figure
        label="Comodines"
        value={formatNumber(streak.wildcardsAvailable)}
        note={
          streak.wildcardUses.length > 0
            ? `${formatNumber(streak.wildcardUses.length)} usados`
            : 'Uno cada 7, máximo 2'
        }
      />
      <Figure
        label="Días cumplidos"
        value={formatNumber(counts.completedDays)}
        note={
          streak.unit === 'day'
            ? `${formatNumber(counts.loggedDays)} días con registro`
            : `${formatNumber(counts.completedUnits)} ${unitLabel} cumplidas`
        }
      />
    </dl>
  );
}

function sampleOf(rate: Rate, unit: HabitHistory['unit']): string {
  if (rate.days === 0) return '–';
  if (unit === 'day') return `${formatNumber(rate.doneDays)} de ${formatNumber(rate.days)} días`;
  const label = unit === 'week' ? 'semanas' : 'meses';
  return `${formatNumber(rate.doneUnits)} de ${formatNumber(rate.units)} ${label}`;
}

const WINDOW_LABEL: Readonly<Record<string, string>> = {
  7: 'Últimos 7 días',
  30: 'Últimos 30 días',
  90: 'Últimos 90 días',
  total: 'Desde el principio',
};

/** Tasa de cumplimiento en cada ventana, siempre con su muestra. */
export function RatesTable({ history }: { history: HabitHistory }) {
  const rates = rateWindows(history);
  return (
    <section className="mt-12" aria-labelledby="cumplimiento">
      <h2 id="cumplimiento" className="label-caps mb-3 border-b border-border pb-2">
        Cumplimiento
      </h2>
      <DataTable
        head={['Periodo', '%', 'Muestra']}
        rows={RATE_WINDOWS.map((window) => {
          const rate = rates[window];
          return [
            WINDOW_LABEL[String(window)] ?? String(window),
            rate.ratio === null ? '–' : formatPercent(rate.ratio),
            <span key="muestra" className="text-text-muted">
              {sampleOf(rate, history.unit)}
            </span>,
          ];
        })}
      />
    </section>
  );
}

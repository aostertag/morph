import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { DataTable } from '@/charts/ChartFigure';
import type { WeekSummary } from '@/domain/review';
import type { HabitAnalysis } from '@/domain/today';
import { AvoidSection } from '@/features/stats/AvoidSection';
import { formatNumber, formatPercent, formatPoints, formatStreak } from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';
import { describeBest, describeHardest, describeMood, describeSample } from './describe';

function DeltaLine({ summary }: { summary: WeekSummary }) {
  const { delta, previous } = summary.score;
  if (delta === null || previous?.ratio == null) {
    return (
      <p className="text-md text-text-muted">
        Sin semana anterior con datos suficientes para comparar.
      </p>
    );
  }
  const Icon = delta > 0.005 ? TrendingUp : delta < -0.005 ? TrendingDown : Minus;
  return (
    <p className="flex items-center gap-2 text-md">
      <Icon size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
      <span>
        <span className="font-medium">{formatPoints(delta)}</span> que la semana anterior (
        {formatPercent(previous.ratio)}).
      </span>
    </p>
  );
}

/** La cifra de la semana, con su comparación y su muestra. */
function Score({ summary }: { summary: WeekSummary }) {
  const { current } = summary.score;
  return (
    <section aria-labelledby="cumplimiento-semana" className="border-b border-border pb-8">
      <h2 id="cumplimiento-semana" className="sr-only">
        Cumplimiento de la semana
      </h2>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <p className="text-4xl font-semibold">
          {current.ratio === null ? '–' : formatPercent(current.ratio)}
        </p>
        <div className="flex flex-col items-start gap-1 pb-1">
          <DeltaLine summary={summary} />
          <p className="text-sm text-text-muted">
            {current.days === 0
              ? 'Ningún día evaluable en esta semana.'
              : `${formatNumber(current.days)} días evaluables de ${formatNumber(current.habits)} ${
                  current.habits === 1 ? 'hábito' : 'hábitos'
                }. Los hábitos a evitar van aparte.`}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Qué hizo cada hábito esa semana, siempre con su muestra. */
function Habits({ summary }: { summary: WeekSummary }) {
  const { ranked, insufficient } = summary.ranking;
  if (ranked.length === 0 && insufficient.length === 0) return null;

  return (
    <section aria-labelledby="habitos-semana" className="mt-12">
      <h2 id="habitos-semana" className="label-caps mb-3 border-b border-border pb-2">
        Hábitos
      </h2>
      {ranked.length === 0 ? (
        <p className="text-md text-text-muted">
          Ningún hábito llega a tres días evaluables en esta semana.
        </p>
      ) : (
        <DataTable
          head={['Hábito', '%', 'Muestra']}
          rows={ranked.map((entry) => [
            <span key="nombre" className="flex items-center gap-2">
              <ColorBar color={entry.habit.color} className="h-4 self-center" />
              <Link
                to={`/habitos/${entry.habit.id}`}
                className="truncate rounded-sm underline-offset-4 hover:underline"
              >
                {entry.habit.name}
              </Link>
            </span>,
            entry.rate.ratio === null ? '–' : formatPercent(entry.rate.ratio),
            <span key="muestra" className="text-text-muted">
              {describeSample(entry)}
            </span>,
          ])}
        />
      )}
      {insufficient.length > 0 && (
        <p className="mt-3 text-sm text-text-muted">
          Con menos de tres días evaluables esta semana:{' '}
          {insufficient.map((entry) => entry.habit.name).join(', ')}.
        </p>
      )}
    </section>
  );
}

/** El más constante, el que más costó y cómo fue el ánimo. */
function Highlights({ summary }: { summary: WeekSummary }) {
  const mood = describeMood(summary);
  if (!summary.best && !summary.hardest && mood === null) return null;

  return (
    <section aria-labelledby="destacado-semana" className="mt-12">
      <h2 id="destacado-semana" className="label-caps mb-3 border-b border-border pb-2">
        Lo que destacó
      </h2>
      <ul className="flex flex-col gap-2 text-md">
        {summary.best && <li>{describeBest(summary.best)}</li>}
        {summary.hardest && <li>{describeHardest(summary.hardest)}</li>}
        {mood && <li className="first-letter:uppercase">{mood}</li>}
      </ul>
    </section>
  );
}

/**
 * Rachas vivas. Solo se enseñan en la última semana cerrada: van siempre a fecha
 * de hoy, así que en una semana antigua dirían algo que no viene al caso.
 */
function Streaks({ analyses }: { analyses: readonly HabitAnalysis[] }) {
  const alive = analyses
    .filter((analysis) => analysis.streak.current > 0)
    .sort((a, b) => b.streak.current - a.streak.current);
  if (alive.length === 0) return null;

  return (
    <section aria-labelledby="rachas-semana" className="mt-12">
      <h2 id="rachas-semana" className="label-caps mb-3 border-b border-border pb-2">
        Rachas vivas
      </h2>
      <ul>
        {alive.map(({ habit, streak }) => (
          <li key={habit.id} className="flex items-baseline gap-2 border-b border-border py-2">
            <ColorBar color={habit.color} className="h-4 self-center" />
            <Link
              to={`/habitos/${habit.id}`}
              className="min-w-0 flex-1 truncate rounded-sm text-md underline-offset-4 hover:underline"
            >
              {habit.name}
            </Link>
            <span className="shrink-0 font-medium">
              {formatStreak(streak.current, streak.unit)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-text-muted">Las rachas van siempre a día de hoy.</p>
    </section>
  );
}

/** El informe completo de una semana cerrada. */
export function WeekReport({
  summary,
  analyses,
  showStreaks,
}: {
  summary: WeekSummary;
  analyses: readonly HabitAnalysis[];
  /** Solo en la última semana cerrada: las rachas se leen a fecha de hoy. */
  showStreaks: boolean;
}) {
  return (
    <>
      <Score summary={summary} />
      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12">
        <div className="min-w-0">
          <Habits summary={summary} />
          <AvoidSection summaries={summary.avoid} />
        </div>
        <div className="min-w-0">
          <Highlights summary={summary} />
          {showStreaks && <Streaks analyses={analyses} />}
        </div>
      </div>
    </>
  );
}

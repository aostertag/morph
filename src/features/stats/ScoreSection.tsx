import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFigure, DataTable } from '@/charts/ChartFigure';
import type { LocalDay, Weekday } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import type { DayRange, RangePreset } from '@/domain/range';
import {
  type ScoreBucket,
  type ScoreComparison,
  type ScorePoint,
  scoreBucket,
  scoreSeries,
} from '@/domain/stats';
import {
  formatMonthShort,
  formatNumber,
  formatPercent,
  formatPoints,
  formatShortDate,
} from '@/lib/format';
import { previousPeriodLabel } from './describe';

interface Point {
  readonly label: string;
  readonly full: string;
  readonly ratio: number | null;
  readonly current: boolean;
  readonly sample: string;
}

function bucketLabel(point: ScorePoint, bucket: ScoreBucket): string {
  if (bucket === 'month') return formatMonthShort(point.start);
  return formatShortDate(point.start);
}

function fullLabel(point: ScorePoint, bucket: ScoreBucket): string {
  switch (bucket) {
    case 'day':
      return formatShortDate(point.start);
    case 'week':
      return `Del ${formatShortDate(point.start)} al ${formatShortDate(point.end)}`;
    case 'month':
      return `${formatMonthShort(point.start)}: del ${formatShortDate(point.start)} al ${formatShortDate(point.end)}`;
  }
}

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-overlay">
      <p className="font-medium">{point.full}</p>
      <p className="text-text-muted">
        {point.ratio === null ? 'Sin días evaluables' : formatPercent(point.ratio)} · {point.sample}
      </p>
    </div>
  );
}

function DeltaLine({ comparison, preset }: { comparison: ScoreComparison; preset: RangePreset }) {
  const { delta, previous } = comparison;
  if (delta === null || previous?.ratio == null) {
    return (
      <p className="text-md text-text-muted">
        Sin período anterior con datos suficientes para comparar.
      </p>
    );
  }

  const Icon = delta > 0.005 ? TrendingUp : delta < -0.005 ? TrendingDown : Minus;
  const previousLabel = previousPeriodLabel(preset);

  return (
    <p className="flex items-center gap-2 text-md">
      <Icon size={18} aria-hidden="true" className="shrink-0 text-text-muted" />
      <span>
        <span className="font-medium">{formatPoints(delta)}</span> que {previousLabel} (
        {formatPercent(previous.ratio)}).
      </span>
    </p>
  );
}

/** La cifra del período, su comparación y la evolución dentro del rango. */
export function ScoreSection({
  histories,
  range,
  rangeLength,
  comparison,
  preset,
  weekStartsOn,
  today,
}: {
  histories: readonly HabitHistory[];
  range: DayRange;
  rangeLength: number;
  comparison: ScoreComparison;
  preset: RangePreset;
  weekStartsOn: Weekday;
  today: LocalDay;
}) {
  const { current } = comparison;
  const bucket = scoreBucket(rangeLength);
  const points: Point[] = scoreSeries(histories, range, bucket, weekStartsOn, today).map(
    (point) => ({
      label: bucketLabel(point, bucket),
      full: fullLabel(point, bucket),
      ratio: point.score.ratio,
      current: point.current,
      sample:
        point.score.days === 0
          ? 'sin días evaluables'
          : `${formatNumber(point.score.days)} días de ${formatNumber(point.score.habits)} hábitos`,
    }),
  );

  return (
    <section aria-labelledby="puntuacion" className="border-b border-border pb-8">
      <h2 id="puntuacion" className="sr-only">
        Puntuación del período
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <p className="text-4xl font-semibold">
          {current.ratio === null ? '–' : formatPercent(current.ratio)}
        </p>
        <div className="flex flex-col items-start gap-1 pb-1">
          <DeltaLine comparison={comparison} preset={preset} />
          <p className="text-sm text-text-muted">
            {current.days === 0
              ? 'Ningún día evaluable en este período.'
              : `${formatNumber(current.days)} días evaluables de ${formatNumber(current.habits)} ${
                  current.habits === 1 ? 'hábito' : 'hábitos'
                }. Los hábitos a evitar van aparte.`}
          </p>
        </div>
      </div>

      {current.days > 0 && (
        <ChartFigure
          title="Evolución del período"
          className="mt-8"
          note="El último tramo, todavía en curso, se dibuja en gris."
          table={
            <DataTable
              head={[
                bucket === 'month' ? 'Mes' : bucket === 'week' ? 'Semana' : 'Día',
                '%',
                'Muestra',
              ]}
              rows={points.map((point) => [
                point.full,
                point.ratio === null ? '–' : formatPercent(point.ratio),
                <span key="muestra" className="text-text-muted">
                  {point.sample}
                </span>,
              ])}
            />
          }
        >
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tickFormatter={(value: number) => formatPercent(value)}
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              />
              <Tooltip content={<ScoreTooltip />} cursor={{ fill: 'var(--color-sunken)' }} />
              <Bar dataKey="ratio" maxBarSize={32} isAnimationActive={false}>
                {points.map((point) => (
                  <Cell
                    key={point.full}
                    fill={point.current ? 'var(--color-border-strong)' : 'var(--color-text)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFigure>
      )}
    </section>
  );
}

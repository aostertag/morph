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
import type { Weekday } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import { type RatePoint, rateSeries, seriesBucket } from '@/domain/metrics';
import { formatMonthYear, formatNumber, formatPercent, formatShortDate } from '@/lib/format';

const WEEKS = 26;
const MONTHS = 12;

interface Point {
  readonly label: string;
  readonly full: string;
  readonly ratio: number | null;
  readonly current: boolean;
  readonly sample: string;
}

function buildPoints(history: HabitHistory, weekStartsOn: Weekday): Point[] {
  const bucket = seriesBucket(history);
  const points = rateSeries(history, bucket, bucket === 'week' ? WEEKS : MONTHS, weekStartsOn);
  return points.map((point: RatePoint) => ({
    label: formatShortDate(point.start),
    full:
      bucket === 'week'
        ? `Semana del ${formatShortDate(point.start)}`
        : formatMonthYear(point.start),
    ratio: point.rate.ratio,
    current: point.current,
    sample:
      point.rate.days === 0
        ? 'sin días evaluables'
        : `${formatNumber(point.rate.doneDays)} de ${formatNumber(point.rate.days)} días`,
  }));
}

function RateTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-overlay">
      <p className="font-medium">{point.full}</p>
      <p className="text-text-muted">
        {point.ratio === null ? 'Sin datos' : formatPercent(point.ratio)} · {point.sample}
      </p>
    </div>
  );
}

/** Evolución de la tasa de cumplimiento, por semanas (o por meses si el hábito es mensual). */
export function WeeklyChart({
  history,
  weekStartsOn,
}: {
  history: HabitHistory;
  weekStartsOn: Weekday;
}) {
  const bucket = seriesBucket(history);
  const points = buildPoints(history, weekStartsOn);
  const measured = points.filter((p) => p.ratio !== null && !p.current);
  const average =
    measured.length === 0
      ? null
      : measured.reduce((sum, p) => sum + (p.ratio ?? 0), 0) / measured.length;

  return (
    <ChartFigure
      title={bucket === 'week' ? 'Evolución semanal' : 'Evolución mensual'}
      note={
        average === null
          ? 'Todavía no hay períodos cerrados.'
          : `Media de los períodos cerrados: ${formatPercent(average)}. El último, en curso, se dibuja en gris.`
      }
      table={
        <DataTable
          head={[bucket === 'week' ? 'Semana' : 'Mes', '%', 'Días']}
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
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            interval={bucket === 'week' ? 3 : 1}
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
          <Tooltip content={<RateTooltip />} cursor={{ fill: 'var(--color-sunken)' }} />
          <Bar dataKey="ratio" isAnimationActive={false}>
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
  );
}

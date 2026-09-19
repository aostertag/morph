import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFigure, DataTable } from '@/charts/ChartFigure';
import { dailyGoal } from '@/domain/evaluate';
import type { HabitHistory } from '@/domain/history';
import { valueSeries, valueStats } from '@/domain/metrics';
import type { Habit } from '@/domain/types';
import { formatMinutes, formatNumber, formatShortDate, withUnit } from '@/lib/format';

const DAYS = 90;

/** Formatea un valor con la unidad del hábito; en los de tiempo, como duración. */
function formatValue(habit: Habit, value: number): string {
  return habit.kind === 'time' ? formatMinutes(value) : withUnit(value, habit.unit);
}

interface Point {
  readonly day: string;
  readonly label: string;
  readonly value: number | null;
  readonly average: number | null;
}

function ValueTooltip({
  active,
  payload,
  habit,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  habit: Habit;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-overlay">
      <p className="font-medium">{point.label}</p>
      <p className="text-text-muted">
        {point.value === null ? 'No toca' : formatValue(habit, point.value)}
        {point.average !== null && ` · media 7 días ${formatValue(habit, point.average)}`}
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | undefined;
}) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1">
        <span className="block text-xl font-semibold">{value}</span>
        {note && <span className="mt-0.5 block text-sm text-text-muted">{note}</span>}
      </dd>
    </div>
  );
}

/** Media, máximo, total y tendencia de los hábitos de cantidad y tiempo. */
export function ValueSection({ history }: { history: HabitHistory }) {
  const { habit } = history;
  const stats = valueStats(history);
  const goal = dailyGoal(habit);
  const points: Point[] = valueSeries(history, DAYS).map((point) => ({
    day: point.day,
    label: formatShortDate(point.day),
    value: point.value,
    average: point.average,
  }));
  const trend = stats.trend;

  return (
    <section className="mt-12" aria-labelledby="cantidades">
      <h2 id="cantidades" className="label-caps mb-4 border-b border-border pb-2">
        {habit.kind === 'time' ? 'Tiempo dedicado' : 'Cantidades'}
      </h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        <Figure
          label="Media"
          value={stats.average === null ? '–' : formatValue(habit, stats.average)}
          note={`En ${formatNumber(stats.loggedDays)} días con registro`}
        />
        <Figure
          label="Máximo"
          value={stats.max === null ? '–' : formatValue(habit, stats.max.value)}
          note={stats.max === null ? undefined : `El ${formatShortDate(stats.max.day)}`}
        />
        <Figure label="Total" value={formatValue(habit, stats.total)} />
        <Figure
          label="Tendencia"
          value={
            trend === null
              ? '–'
              : `${trend.delta >= 0 ? '+' : '−'}${formatValue(habit, Math.abs(trend.delta))}`
          }
          note={
            trend === null
              ? 'Hacen falta más días'
              : `${formatValue(habit, trend.recent)} al día frente a ${formatValue(habit, trend.previous)}`
          }
        />
      </dl>

      <ChartFigure
        title={`Últimos ${DAYS} días`}
        note={`Cada barra es un día; la línea es la media de los 7 días anteriores. La meta diaria es ${formatValue(habit, goal)}.`}
        table={
          <DataTable
            head={['Día', 'Valor', 'Media 7 días']}
            rows={[...points].reverse().map((point) => [
              point.label,
              point.value === null ? 'No toca' : formatValue(habit, point.value),
              <span key="media" className="text-text-muted">
                {point.average === null ? '–' : formatValue(habit, point.average)}
              </span>,
            ])}
          />
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              interval={13}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              tickFormatter={(value: number) => formatNumber(value)}
            />
            <Tooltip
              content={<ValueTooltip habit={habit} />}
              cursor={{ fill: 'var(--color-sunken)' }}
            />
            <ReferenceLine
              y={goal}
              stroke="var(--color-accent)"
              label={{
                value: 'Meta',
                position: 'insideTopRight',
                fill: 'var(--color-accent)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="var(--color-border)" isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="average"
              stroke="var(--color-text)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFigure>
    </section>
  );
}

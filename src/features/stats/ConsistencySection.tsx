import { Link } from 'react-router';
import type { HabitRate, Ranking } from '@/domain/stats';
import { cx } from '@/lib/cx';
import { formatNumber, formatPercent } from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';
import { BAR_TABLE, BarTableColumns, FIGURE_CELL } from './barTable';

function Row({ entry }: { entry: HabitRate }) {
  const { habit, rate } = entry;
  const ratio = rate.ratio ?? 0;
  return (
    <tr className="border-b border-border">
      <th scope="row" className="pr-3 text-left font-normal">
        <span className="flex items-stretch gap-2">
          <ColorBar color={habit.color} />
          <Link
            to={`/habitos/${habit.id}`}
            className="min-w-0 flex-1 truncate rounded-sm py-2 underline-offset-4 hover:underline"
          >
            {habit.name}
          </Link>
        </span>
      </th>
      <td className="py-2">
        <span aria-hidden="true" className="relative block h-2 w-full bg-sunken">
          <span
            className="absolute inset-y-0 left-0 bg-text"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      </td>
      <td className={cx(FIGURE_CELL, 'py-2')}>
        {formatPercent(ratio)}{' '}
        <span className="text-text-muted">({formatNumber(rate.days)} d)</span>
      </td>
    </tr>
  );
}

/** Ranking de consistencia del período, con la muestra de cada hábito. */
export function ConsistencySection({ ranking }: { ranking: Ranking }) {
  const { ranked, insufficient } = ranking;
  if (ranked.length === 0 && insufficient.length === 0) return null;

  return (
    <section aria-labelledby="consistencia" className="mt-12">
      <h2 id="consistencia" className="label-caps mb-3 border-b border-border pb-2">
        Consistencia
      </h2>

      {ranked.length === 0 ? (
        <p className="text-md text-text-muted">
          Ningún hábito llega a una semana de días evaluables en este período.
        </p>
      ) : (
        <table className={BAR_TABLE}>
          <caption className="sr-only">
            Tasa de cumplimiento de cada hábito en el período, con los días evaluables
          </caption>
          <BarTableColumns />
          <thead className="sr-only">
            <tr>
              <th scope="col">Hábito</th>
              <th scope="col">Proporción</th>
              <th scope="col">Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((entry) => (
              <Row key={entry.habit.id} entry={entry} />
            ))}
          </tbody>
        </table>
      )}

      {insufficient.length > 0 && (
        <p className="mt-3 text-sm text-text-muted">
          Sin datos suficientes para ordenarlos:{' '}
          {insufficient.map((entry) => entry.habit.name).join(', ')}.
        </p>
      )}
    </section>
  );
}

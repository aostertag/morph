import { Link } from 'react-router';
import type { HabitRate, Ranking } from '@/domain/stats';
import { formatNumber, formatPercent } from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';

function Row({ entry }: { entry: HabitRate }) {
  const { habit, rate } = entry;
  const ratio = rate.ratio ?? 0;
  return (
    <tr className="border-b border-border">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className="flex items-center gap-2">
          <ColorBar color={habit.color} className="h-4 self-center" />
          <Link
            to={`/habitos/${habit.id}`}
            className="truncate rounded-sm underline-offset-4 hover:underline"
          >
            {habit.name}
          </Link>
        </span>
      </th>
      <td className="w-[35%] py-2">
        <span aria-hidden="true" className="relative block h-2 w-full bg-sunken">
          <span
            className="absolute inset-y-0 left-0 bg-text"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      </td>
      <td className="w-32 py-2 text-right">
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
        <table className="w-full text-md">
          <caption className="sr-only">
            Tasa de cumplimiento de cada hábito en el período, con los días evaluables
          </caption>
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

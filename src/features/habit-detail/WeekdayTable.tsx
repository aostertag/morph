import type { Weekday } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import { weekdayStats } from '@/domain/metrics';
import { formatNumber, formatPercent, orderedWeekdays, weekdayLong } from '@/lib/format';

/**
 * Rendimiento por día de la semana. Es una tabla con barras: los números se leen
 * igual con y sin las barras, así que no hace falta una alternativa aparte.
 */
export function WeekdayTable({
  history,
  weekStartsOn,
}: {
  history: HabitHistory;
  weekStartsOn: Weekday;
}) {
  const avoid = history.habit.kind === 'avoid';
  const stats = weekdayStats(history);
  const byWeekday = new Map(stats.map((stat) => [stat.weekday, stat]));
  const rows = orderedWeekdays(weekStartsOn).map((weekday) => byWeekday.get(weekday));
  const best = Math.max(...stats.map((stat) => stat.ratio ?? 0));

  return (
    <section className="mt-12" aria-labelledby="dia-semana">
      <h2 id="dia-semana" className="label-caps mb-3 border-b border-border pb-2">
        {avoid ? 'Recaídas por día de la semana' : 'Por día de la semana'}
      </h2>
      <table className="w-full text-md">
        <caption className="sr-only">
          {avoid
            ? 'Días con recaída sobre los días evaluables de cada día de la semana'
            : 'Días cumplidos sobre los días evaluables de cada día de la semana'}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Proporción</th>
            <th scope="col">{avoid ? 'Recaídas' : 'Cumplidos'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((stat) => {
            if (!stat) return null;
            const ratio = stat.ratio;
            const highlight = !avoid && ratio !== null && ratio === best && ratio > 0;
            return (
              <tr key={stat.weekday} className="border-b border-border">
                <th
                  scope="row"
                  className={`w-24 py-2 text-left font-normal ${highlight ? 'font-medium' : ''}`}
                >
                  {weekdayLong(stat.weekday)}
                </th>
                <td className="py-2">
                  <span aria-hidden="true" className="relative block h-2 w-full bg-sunken">
                    <span
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${(ratio ?? 0) * 100}%`,
                        backgroundColor: avoid ? 'var(--color-relapse-1)' : 'var(--color-text)',
                      }}
                    />
                  </span>
                </td>
                <td className="w-36 py-2 text-right">
                  {ratio === null ? (
                    <span className="text-text-muted">Sin datos</span>
                  ) : (
                    <>
                      {formatPercent(ratio)}{' '}
                      <span className="text-text-muted">
                        ({formatNumber(stat.hits)} de {formatNumber(stat.total)})
                      </span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

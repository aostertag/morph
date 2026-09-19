import type { Weekday } from '@/domain/day';
import type { WeekdayBreakdown } from '@/domain/stats';
import { formatNumber, formatPercent, orderedWeekdays, weekdayLong } from '@/lib/format';

/** Cumplimiento por día de la semana, con el mejor y el peor solo si hay muestra. */
export function WeekdaySection({
  breakdown,
  weekStartsOn,
}: {
  breakdown: WeekdayBreakdown;
  weekStartsOn: Weekday;
}) {
  const byWeekday = new Map(breakdown.scores.map((score) => [score.weekday, score]));
  const rows = orderedWeekdays(weekStartsOn).map((weekday) => byWeekday.get(weekday));
  const hasData = breakdown.scores.some((score) => score.days > 0);

  return (
    <section aria-labelledby="dia-semana" className="mt-12">
      <h2 id="dia-semana" className="label-caps mb-3 border-b border-border pb-2">
        Por día de la semana
      </h2>

      {!hasData ? (
        <p className="text-md text-text-muted">Sin días evaluables en este período.</p>
      ) : (
        <>
          <table className="w-full text-md">
            <caption className="sr-only">
              Cumplimiento de todos los hábitos en cada día de la semana, con los días evaluables
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Proporción</th>
                <th scope="col">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((score) => {
                if (!score) return null;
                const highlight = score.weekday === breakdown.best;
                return (
                  <tr key={score.weekday} className="border-b border-border">
                    <th
                      scope="row"
                      className={`w-24 py-2 text-left ${highlight ? 'font-medium' : 'font-normal'}`}
                    >
                      {weekdayLong(score.weekday)}
                    </th>
                    <td className="py-2">
                      <span aria-hidden="true" className="relative block h-2 w-full bg-sunken">
                        <span
                          className="absolute inset-y-0 left-0 bg-text"
                          style={{ width: `${(score.ratio ?? 0) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="w-32 py-2 text-right">
                      {score.ratio === null ? (
                        <span className="text-text-muted">Sin datos</span>
                      ) : (
                        <>
                          {formatPercent(score.ratio)}{' '}
                          <span className="text-text-muted">({formatNumber(score.days)} d)</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-sm text-text-muted">
            {breakdown.best !== null && breakdown.worst !== null
              ? `El mejor día es el ${weekdayLong(breakdown.best)} y el que más cuesta, el ${weekdayLong(breakdown.worst)}.`
              : 'Hacen falta al menos dos semanas y cuatro días evaluables de cada día para señalar el mejor y el peor.'}
          </p>
        </>
      )}
    </section>
  );
}

import { addDays, eachDay, type LocalDay, weekdayOf } from '@/domain/day';
import { dayProgress, type HabitAnalysis, viewForDay } from '@/domain/today';
import { cx } from '@/lib/cx';
import {
  formatDate,
  formatPercent,
  formatStreak,
  formatWeekday,
  weekdayLetter,
} from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';

/** Panel lateral de escritorio: últimos 7 días y rachas activas. */
export function SidePanel({
  analyses,
  day,
  today,
  onSelectDay,
}: {
  analyses: readonly HabitAnalysis[];
  day: LocalDay;
  today: LocalDay;
  onSelectDay: (day: LocalDay) => void;
}) {
  const week = eachDay(addDays(today, -6), today).map((d) => {
    const views = analyses.map((a) => viewForDay(a, d)).filter((v) => v.scheduled);
    return { day: d, progress: dayProgress(views) };
  });

  const streaks = analyses
    .filter(
      (a) =>
        a.habit.archivedOn === null && (a.streak.current > 0 || a.streak.wildcardsAvailable > 0),
    )
    .sort((a, b) => b.streak.current - a.streak.current);

  return (
    <aside className="flex flex-col gap-10" aria-label="Resumen">
      <section>
        <h2 className="label-caps mb-4">Últimos 7 días</h2>
        <ol className="grid grid-cols-7 gap-1">
          {week.map(({ day: d, progress }) => {
            const label = `${formatWeekday(d)} ${formatDate(d, today)}: ${
              progress.total === 0 ? 'nada programado' : `${progress.done} de ${progress.total}`
            }`;
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => onSelectDay(d)}
                  aria-label={label}
                  aria-current={d === day ? 'date' : undefined}
                  className={cx(
                    'flex w-full flex-col items-center gap-1.5 rounded-md py-2 hover:bg-sunken',
                    d === day && 'bg-sunken',
                  )}
                >
                  <span
                    className={cx(
                      'text-xs',
                      d === today ? 'font-semibold text-accent' : 'text-text-muted',
                    )}
                  >
                    {weekdayLetter(weekdayOf(d))}
                  </span>
                  <span aria-hidden="true" className="relative h-10 w-2 bg-sunken">
                    <span
                      className="absolute inset-x-0 bottom-0 bg-text"
                      style={{ height: `${progress.ratio * 100}%` }}
                    />
                  </span>
                  <span className="text-xs text-text-muted">
                    {progress.total === 0 ? '–' : formatPercent(progress.ratio)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="label-caps mb-2">Rachas activas</h2>
        {streaks.length === 0 ? (
          <p className="text-md text-text-muted">Sin rachas activas.</p>
        ) : (
          <table className="w-full text-md">
            <thead className="sr-only">
              <tr>
                <th scope="col">Hábito</th>
                <th scope="col">Racha</th>
                <th scope="col">Comodines</th>
              </tr>
            </thead>
            <tbody>
              {streaks.map(({ habit, streak }) => (
                <tr key={habit.id} className="border-b border-border">
                  <th scope="row" className="py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <ColorBar color={habit.color} className="h-4 self-center" />
                      <span className="truncate">{habit.name}</span>
                    </span>
                  </th>
                  <td className="py-2 text-right font-medium">
                    {streak.current > 0 ? formatStreak(streak.current, streak.unit) : '–'}
                  </td>
                  <td className="w-20 py-2 text-right text-text-muted">
                    {streak.wildcardsAvailable > 0 &&
                      `${streak.wildcardsAvailable} ${streak.wildcardsAvailable === 1 ? 'comodín' : 'comodines'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </aside>
  );
}

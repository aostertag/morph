import { type CSSProperties, useEffect, useRef } from 'react';
import {
  addDays,
  dayOfMonth,
  eachDay,
  type LocalDay,
  startOfWeek,
  type Weekday,
  weekdayOf,
} from '@/domain/day';
import { type DayProgress, dayProgress, type HabitAnalysis, viewForDay } from '@/domain/today';
import { cx } from '@/lib/cx';
import { formatDate, formatWeek, formatWeekday, weekdayLetter } from '@/lib/format';

/** Marca de cumplimiento bajo el número: anillo si va a medias, punto si está completo. */
function DayMark({ progress }: { progress: DayProgress }) {
  if (progress.done === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'block size-1.5 rounded-full',
        progress.complete ? 'bg-text' : 'border border-text',
      )}
    />
  );
}

/** Posición de la columna (0–6) para el reparto por debajo de `narrow`. */
function columnStyle(index: number): CSSProperties & Record<'--column', number> {
  return { '--column': index };
}

/**
 * Tira de la semana natural del día elegido, solo en móvil (en escritorio ya está el panel
 * lateral). Un solo punto de tabulación, el día elegido: las flechas son los atajos de
 * siempre y el foco sigue al día nuevo. Los días futuros no se pueden elegir.
 *
 * Por debajo de `narrow` (340 px) siete días de 44 px no caben entre los márgenes. Ahí la
 * tira se mete 12 px en cada margen (`-mx-3`) para que las áreas táctiles lleguen a 44 px,
 * pero lo visible no: cada columna desplaza su contenido hacia el centro lo justo para que
 * el recuadro del lunes empiece en el margen y el del domingo acabe en él, repartidos por
 * igual. Siendo h el ancho de columna (100cqw / 7), el desplazamiento de la columna i es
 * (3 − i) · (2 · 12 px + 32 px − h) / 6, y cada recuadro sigue dentro de su propia área.
 * El foco se dibuja entonces en el recuadro, no en el botón, que llega hasta el margen.
 */
export function WeekStrip({
  analyses,
  day,
  today,
  weekStartsOn,
  onSelectDay,
}: {
  analyses: readonly HabitAnalysis[];
  day: LocalDay;
  today: LocalDay;
  weekStartsOn: Weekday;
  onSelectDay: (day: LocalDay) => void;
}) {
  const start = startOfWeek(day, weekStartsOn);
  const week = eachDay(start, addDays(start, 6)).map((d) => {
    if (d > today) return { day: d, progress: null };
    const views = analyses.map((a) => viewForDay(a, d)).filter((v) => v.scheduled);
    return { day: d, progress: dayProgress(views) };
  });

  // Si el foco estaba en la tira, pasa al día elegido (las flechas lo cambian desde fuera).
  // Los botones se identifican por su posición, así que al cambiar de semana no se pierde.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus();
  }, [day]);

  return (
    <nav
      aria-label={formatWeek({ from: start, to: addDays(start, 6) }, today)}
      className="-mt-2 mb-2 lg:hidden max-narrow:-mx-3"
    >
      <ol ref={listRef} className="grid grid-cols-7 max-narrow:@container">
        {week.map(({ day: d, progress }, index) => {
          const selected = d === day;
          const isToday = d === today;
          const future = progress === null;
          const state = future
            ? ''
            : progress.total === 0
              ? ': nada programado'
              : `: ${progress.done} de ${progress.total} hábitos`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: la posición en la semana es la identidad del botón (conserva el foco al cambiar de semana).
            <li key={index} style={columnStyle(index)}>
              <button
                type="button"
                data-day={d}
                disabled={future}
                tabIndex={selected ? 0 : -1}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${formatWeekday(d)} ${formatDate(d, today)}${isToday ? ', hoy' : ''}${state}`}
                onClick={() => onSelectDay(d)}
                className="group flex min-h-touch w-full justify-center rounded-md py-2 narrow:enabled:hover:bg-sunken max-narrow:focus-visible:outline-none"
              >
                <span className="flex flex-col items-center gap-1.5 max-narrow:translate-x-[calc((3_-_var(--column))_*_(var(--spacing)_*_14_-_100cqw_/_7)_/_6)]">
                  <span className={cx('label-caps', isToday && 'text-accent')}>
                    {weekdayLetter(weekdayOf(d))}
                  </span>
                  <span
                    className={cx(
                      'grid size-8 place-items-center rounded-sm text-base max-narrow:group-focus-visible:outline-2 max-narrow:group-focus-visible:outline-accent max-narrow:group-focus-visible:outline-offset-2',
                      selected
                        ? 'bg-text font-semibold text-bg'
                        : isToday
                          ? 'font-medium text-accent ring-1 ring-accent ring-inset'
                          : future
                            ? 'font-medium text-text-faint'
                            : 'font-medium',
                    )}
                  >
                    {dayOfMonth(d)}
                  </span>
                  <span className="flex h-1.5 items-center">
                    {progress && <DayMark progress={progress} />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

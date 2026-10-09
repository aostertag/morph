import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  addDays,
  dayOfMonth,
  eachDay,
  type LocalDay,
  maxDay,
  minDay,
  weekdayOf,
} from '@/domain/day';
import { type DayProgress, dayProgress, type HabitAnalysis, viewForDay } from '@/domain/today';
import { cx } from '@/lib/cx';
import { formatDate, formatWeekday, weekdayLetter } from '@/lib/format';

/** Días futuros que se dibujan (desactivados) para poder centrar hoy en la tira. */
export const FUTURE_DAYS = 3;
/** Hasta dónde llega la tira hacia atrás: el primer hábito, con este tope. */
const MAX_PAST_DAYS = 365;
const DEFAULT_PAST_DAYS = 28;

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

/**
 * Tira de días de Hoy, solo en móvil (en escritorio ya está el panel lateral). Es una línea
 * continua que se desliza con el dedo y encaja día a día (`scroll-snap`); al elegir un día
 * (tocando, con las flechas o por la URL) se centra. Arrastrarla solo navega: no cambia el
 * día elegido. Termina en hoy + {@link FUTURE_DAYS}, así que hoy puede quedar en el centro y
 * no se puede ir más allá. No usa `weekStartsOn`: no hay semanas, solo una ventana de siete
 * días visibles. Un solo punto de tabulación (el día elegido); las flechas son los atajos de
 * siempre y el foco sigue al día nuevo. Los días futuros no se pueden elegir.
 */
export function WeekStrip({
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
  const earliest = useMemo(() => {
    const created = analyses.map((a) => a.habit.createdOn);
    const first = created.length > 0 ? created.reduce((a, b) => minDay(a, b)) : null;
    return first ?? addDays(today, -DEFAULT_PAST_DAYS);
  }, [analyses, today]);
  const from = minDay(maxDay(earliest, addDays(today, -MAX_PAST_DAYS)), day);
  const days = useMemo(() => eachDay(from, addDays(today, FUTURE_DAYS)), [from, today]);

  const listRef = useRef<HTMLOListElement>(null);
  const placed = useRef(false);

  // Centra el día elegido: sin animación la primera vez o con movimiento reducido.
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.parentElement;
    if (!list || !item) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    list.scrollTo?.({
      left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
      behavior: placed.current && !reduced ? 'smooth' : 'instant',
    });
    placed.current = true;
  }, [day]);

  // Si el foco estaba en la tira, pasa al día elegido (las flechas lo cambian desde fuera).
  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus({ preventScroll: true });
  }, [day]);

  return (
    <nav aria-label="Días" className="-mt-2 mb-2 -mx-4 lg:hidden">
      <ol
        ref={listRef}
        className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d) => {
          const selected = d === day;
          const isToday = d === today;
          const future = d > today;
          const progress = future ? null : progressOf(analyses, d);
          const state = !progress
            ? ''
            : progress.total === 0
              ? ': nada programado'
              : `: ${progress.done} de ${progress.total} hábitos`;
          return (
            <li key={d} className="w-[calc(100%/7)] min-w-touch shrink-0 snap-center">
              <button
                type="button"
                data-day={d}
                disabled={future}
                tabIndex={selected ? 0 : -1}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${formatWeekday(d)} ${formatDate(d, today)}${isToday ? ', hoy' : ''}${state}`}
                onClick={() => onSelectDay(d)}
                className="flex min-h-touch w-full flex-col items-center gap-1.5 rounded-md py-2 enabled:hover:bg-sunken"
              >
                <span className={cx('label-caps', isToday && 'text-accent')}>
                  {weekdayLetter(weekdayOf(d))}
                </span>
                <span
                  className={cx(
                    'grid size-8 place-items-center rounded-sm text-base',
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
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function progressOf(analyses: readonly HabitAnalysis[], d: LocalDay): DayProgress {
  const views = analyses.map((a) => viewForDay(a, d)).filter((v) => v.scheduled);
  return dayProgress(views);
}
